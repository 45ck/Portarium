/**
 * Approval CRUD HTTP handlers for the control-plane runtime.
 *
 * Endpoints:
 *   GET  /v1/workspaces/:workspaceId/approvals                     — list
 *   POST /v1/workspaces/:workspaceId/approvals                     — create
 *   GET  /v1/workspaces/:workspaceId/approvals/:approvalId         — get
 *   POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide  — decide
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  ApprovalId,
  WorkspaceId,
  type ApprovalDecision,
  type TenantId,
} from '../../domain/primitives/index.js';
import type { ApprovalStatus, ApprovalV1 } from '../../domain/approvals/index.js';
import { parseApprovalPacketV1 } from '../../domain/approvals/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';
import type { AgentActionProposalStore } from '../../application/ports/index.js';
import { listApprovals } from '../../application/queries/list-approvals.js';
import { getApproval } from '../../application/queries/get-approval.js';
import {
  createApproval,
  type CreateApprovalError,
} from '../../application/commands/create-approval.js';
import {
  submitApproval,
  type SubmitApprovalError,
} from '../../application/commands/submit-approval.js';
import { approvalDecisionsTotal } from '../../infrastructure/observability/prometheus-registry.js';
import type { PortariumLogger } from '../../infrastructure/observability/logger.js';
import {
  type ControlPlaneDeps,
  GENERIC_DEPENDENCY_FAILURE_DETAIL,
  authenticate,
  normalizeHeader,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

const APPROVAL_STATUS_QUERY_VALUES = [
  'Pending',
  'Approved',
  'Executing',
  'Denied',
  'Executed',
  'Expired',
  'RequestChanges',
] as const;
const CREATE_APPROVAL_REQUEST_FIELDS = new Set([
  'runId',
  'planId',
  'workItemId',
  'prompt',
  'assigneeUserId',
  'dueAtIso',
  'approvalPacket',
]);

function isApprovalStatusQueryValue(value: string): value is ApprovalStatus {
  return APPROVAL_STATUS_QUERY_VALUES.includes(
    value as (typeof APPROVAL_STATUS_QUERY_VALUES)[number],
  );
}

function validateApprovalStatusQueryValue(
  value: string | null,
): ApprovalStatus | undefined | { readonly error: string } {
  if (value === null) return undefined;
  if (isApprovalStatusQueryValue(value)) return value;
  return {
    error: `status must be one of: ${APPROVAL_STATUS_QUERY_VALUES.join(', ')}.`,
  };
}

function validatePositiveIntegerQueryValue(
  value: string | null,
  field: string,
): number | undefined | { readonly error: string } {
  if (value === null) return undefined;
  if (!/^[1-9]\d*$/.test(value)) {
    return { error: `${field} must be a positive integer.` };
  }
  return Number.parseInt(value, 10);
}

// ---------------------------------------------------------------------------
// Handler argument types
// ---------------------------------------------------------------------------

type ApprovalHandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
  log?: PortariumLogger;
}>;

type ApprovalItemArgs = ApprovalHandlerArgs & Readonly<{ approvalId: string }>;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

const VALID_DECISIONS: readonly ApprovalDecision[] = ['Approved', 'Denied', 'RequestChanges'];

function submitErrorToProblem(
  error: SubmitApprovalError,
  instance: string,
): import('./control-plane-handler.shared.js').ProblemDetails {
  switch (error.kind) {
    case 'Forbidden':
    case 'ValidationFailed':
    case 'NotFound':
      return problemFromError(error, instance);
    case 'Conflict':
      return {
        type: 'https://portarium.dev/problems/conflict',
        title: 'Conflict',
        status: 409,
        detail: error.message,
        instance,
      };
    case 'DependencyFailure':
      return {
        type: 'https://portarium.dev/problems/dependency-failure',
        title: 'Bad Gateway',
        status: 502,
        detail: GENERIC_DEPENDENCY_FAILURE_DETAIL,
        instance,
      };
  }
}

function createErrorToProblem(
  error: CreateApprovalError,
  instance: string,
): import('./control-plane-handler.shared.js').ProblemDetails {
  switch (error.kind) {
    case 'Forbidden':
    case 'ValidationFailed':
      return problemFromError(error, instance);
    case 'DependencyFailure':
      return {
        type: 'https://portarium.dev/problems/dependency-failure',
        title: 'Bad Gateway',
        status: 502,
        detail: GENERIC_DEPENDENCY_FAILURE_DETAIL,
        instance,
      };
  }
}

// ---------------------------------------------------------------------------
// Agent action proposal enrichment
// ---------------------------------------------------------------------------

interface AgentActionProposalMeta {
  proposalId: string;
  agentId: string;
  machineId?: string;
  toolName: string;
  toolCategory: string;
  blastRadiusTier: string;
  rationale: string;
}

function proposalToMeta(proposal: AgentActionProposalV1): AgentActionProposalMeta {
  return {
    proposalId: String(proposal.proposalId),
    agentId: String(proposal.agentId),
    ...(proposal.machineId ? { machineId: String(proposal.machineId) } : {}),
    toolName: proposal.toolName,
    toolCategory: proposal.toolClassification.category,
    blastRadiusTier: proposal.toolClassification.minimumTier,
    rationale: proposal.rationale,
  };
}

async function enrichApprovalWithProposal(
  store: AgentActionProposalStore,
  tenantId: TenantId,
  approval: ApprovalV1,
): Promise<Record<string, unknown>> {
  const plain = { ...approval } as Record<string, unknown>;
  try {
    const proposal = await store.getProposalByApprovalId(
      tenantId,
      ApprovalId(String(approval.approvalId)),
    );
    if (proposal) {
      plain['agentActionProposal'] = proposalToMeta(proposal);
    }
  } catch {
    // Non-fatal: if enrichment fails, return the approval without proposal metadata.
  }
  return plain;
}

async function enrichApprovalsWithProposals(
  store: AgentActionProposalStore | undefined,
  tenantId: TenantId,
  approvals: readonly ApprovalV1[],
): Promise<readonly Record<string, unknown>[]> {
  if (!store) return approvals as unknown as Record<string, unknown>[];
  return Promise.all(approvals.map((a) => enrichApprovalWithProposal(store, tenantId, a)));
}

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/approvals
// ---------------------------------------------------------------------------

export async function handleListApprovals(args: ApprovalHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  if (!deps.approvalQueryStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Approval listing is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const status = validateApprovalStatusQueryValue(url.searchParams.get('status'));
  if (typeof status === 'object') {
    respondProblem(
      res,
      problemFromError({ kind: 'ValidationFailed', message: status.error }, pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  const limit = validatePositiveIntegerQueryValue(url.searchParams.get('limit'), 'limit');
  if (typeof limit === 'object') {
    respondProblem(
      res,
      problemFromError({ kind: 'ValidationFailed', message: limit.error }, pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await listApprovals(
    { authorization: deps.authorization, approvalStore: deps.approvalQueryStore },
    auth.ctx,
    {
      workspaceId,
      ...(status ? { status } : {}),
      ...(url.searchParams.get('runId') ? { runId: url.searchParams.get('runId')! } : {}),
      ...(url.searchParams.get('planId') ? { planId: url.searchParams.get('planId')! } : {}),
      ...(url.searchParams.get('workItemId')
        ? { workItemId: url.searchParams.get('workItemId')! }
        : {}),
      ...(url.searchParams.get('assigneeUserId')
        ? { assigneeUserId: url.searchParams.get('assigneeUserId')! }
        : {}),
      ...(url.searchParams.get('requestedByUserId')
        ? { requestedByUserId: url.searchParams.get('requestedByUserId')! }
        : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(url.searchParams.get('cursor') ? { cursor: url.searchParams.get('cursor')! } : {}),
    },
  );

  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  const enrichedItems = await enrichApprovalsWithProposals(
    deps.agentActionProposalStore,
    auth.ctx.tenantId,
    result.value.items,
  );
  const body = { ...result.value, items: enrichedItems };

  respondJson(res, { statusCode: 200, correlationId, traceContext, body });
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/approvals
// ---------------------------------------------------------------------------

export async function handleCreateApproval(args: ApprovalHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  if (!deps.approvalStore || !deps.evidenceLog) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail:
          'Approval creation is unavailable: approvalStore and evidenceLog must be configured.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    respondProblem(
      res,
      {
        type:
          bodyResult.error === 'unsupported-content-type'
            ? 'https://portarium.dev/problems/unsupported-media-type'
            : 'https://portarium.dev/problems/bad-request',
        title:
          bodyResult.error === 'unsupported-content-type'
            ? 'Unsupported Media Type'
            : 'Bad Request',
        status: bodyResult.error === 'unsupported-content-type' ? 415 : 400,
        detail:
          bodyResult.error === 'invalid-json'
            ? 'Request body contains invalid JSON.'
            : bodyResult.error === 'empty-body'
              ? 'Request body must not be empty.'
              : 'Content-Type must be application/json.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  if (!bodyResult.value || typeof bodyResult.value !== 'object') {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const record = bodyResult.value as Record<string, unknown>;
  const unknownFields = Object.keys(record).filter(
    (field) => !CREATE_APPROVAL_REQUEST_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: `Unknown create approval field(s): ${unknownFields.join(', ')}.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const commandDeps = {
    authorization: deps.authorization,
    clock: { nowIso: () => (deps.clock ?? (() => new Date()))().toISOString() },
    idGenerator: { generateId: () => crypto.randomUUID() },
    approvalStore: deps.approvalStore,
    unitOfWork: deps.unitOfWork ?? { execute: async <T>(fn: () => Promise<T>) => fn() },
    eventPublisher: deps.eventPublisher ?? {
      publish: async () => {
        /* noop stub */
      },
    },
    evidenceLog: deps.evidenceLog,
    ...(deps.idempotency ? { idempotency: deps.idempotency } : {}),
  };

  const idempotencyKey = normalizeHeader(req.headers['idempotency-key'])?.trim();
  let approvalPacket: ReturnType<typeof parseApprovalPacketV1> | undefined;
  if (record['approvalPacket'] !== undefined) {
    try {
      approvalPacket = parseApprovalPacketV1(record['approvalPacket']);
    } catch (error) {
      respondProblem(
        res,
        problemFromError(
          {
            kind: 'ValidationFailed',
            message:
              error instanceof Error ? error.message : 'approvalPacket must be a valid packet.',
          },
          pathname,
        ),
        correlationId,
        traceContext,
      );
      return;
    }
  }
  const result = await createApproval(commandDeps, auth.ctx, {
    workspaceId,
    runId: typeof record['runId'] === 'string' ? record['runId'] : '',
    planId: typeof record['planId'] === 'string' ? record['planId'] : '',
    prompt: typeof record['prompt'] === 'string' ? record['prompt'] : '',
    ...(typeof record['workItemId'] === 'string' ? { workItemId: record['workItemId'] } : {}),
    ...(typeof record['assigneeUserId'] === 'string'
      ? { assigneeUserId: record['assigneeUserId'] }
      : {}),
    ...(typeof record['dueAtIso'] === 'string' ? { dueAtIso: record['dueAtIso'] } : {}),
    ...(approvalPacket ? { approvalPacket } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  } as Parameters<typeof createApproval>[2] & { idempotencyKey?: string });

  if (!result.ok) {
    respondProblem(res, createErrorToProblem(result.error, pathname), correlationId, traceContext);
    return;
  }

  const approval = await deps.approvalStore.getApprovalById(
    auth.ctx.tenantId,
    WorkspaceId(workspaceId),
    result.value.approvalId,
  );
  if (!approval) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/dependency-failure',
        title: 'Bad Gateway',
        status: 502,
        detail: GENERIC_DEPENDENCY_FAILURE_DETAIL,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: 201,
    correlationId,
    traceContext,
    body: approval,
    location: `/v1/workspaces/${encodeURIComponent(workspaceId)}/approvals/${encodeURIComponent(
      String(approval.approvalId),
    )}`,
  });
}

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/approvals/:approvalId
// ---------------------------------------------------------------------------

export async function handleGetApproval(args: ApprovalItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, approvalId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  if (!deps.approvalStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Approval store is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await getApproval(
    { authorization: deps.authorization, approvalStore: deps.approvalStore },
    auth.ctx,
    { workspaceId, approvalId },
  );

  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  let body: Record<string, unknown> = result.value as unknown as Record<string, unknown>;
  if (deps.agentActionProposalStore) {
    body = await enrichApprovalWithProposal(
      deps.agentActionProposalStore,
      auth.ctx.tenantId,
      result.value,
    );
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body });
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide
// ---------------------------------------------------------------------------

export async function handleDecideApproval(args: ApprovalItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, approvalId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  if (!deps.approvalStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Approval store is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    respondProblem(
      res,
      {
        type:
          bodyResult.error === 'unsupported-content-type'
            ? 'https://portarium.dev/problems/unsupported-media-type'
            : 'https://portarium.dev/problems/bad-request',
        title:
          bodyResult.error === 'unsupported-content-type'
            ? 'Unsupported Media Type'
            : 'Bad Request',
        status: bodyResult.error === 'unsupported-content-type' ? 415 : 400,
        detail:
          bodyResult.error === 'invalid-json'
            ? 'Request body contains invalid JSON.'
            : bodyResult.error === 'empty-body'
              ? 'Request body must not be empty.'
              : 'Content-Type must be application/json.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = bodyResult.value;
  if (!body || typeof body !== 'object') {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const record = body as Record<string, unknown>;
  const decision = record['decision'];
  if (typeof decision !== 'string' || !VALID_DECISIONS.includes(decision as ApprovalDecision)) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: `decision must be one of: ${VALID_DECISIONS.join(', ')}.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const commandDeps = {
    authorization: deps.authorization,
    clock: { nowIso: () => new Date().toISOString() },
    idGenerator: { generateId: () => crypto.randomUUID() },
    approvalStore: deps.approvalStore,
    unitOfWork: deps.unitOfWork ?? { execute: async <T>(fn: () => Promise<T>) => fn() },
    eventPublisher: deps.eventPublisher ?? {
      publish: async () => {
        /* noop stub */
      },
    },
    ...(deps.evidenceLog ? { evidenceLog: deps.evidenceLog } : {}),
    ...(deps.idempotency ? { idempotency: deps.idempotency } : {}),
    ...(deps.agentActionProposalStore
      ? { agentActionProposalStore: deps.agentActionProposalStore }
      : {}),
  };

  const idempotencyKey = normalizeHeader(req.headers['idempotency-key'])?.trim();
  const input: Parameters<typeof submitApproval>[2] = {
    workspaceId,
    approvalId,
    decision: decision as ApprovalDecision,
    rationale: String(record['rationale'] ?? ''),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
  if (Array.isArray(record['sodConstraints'])) {
    (input as { sodConstraints?: unknown }).sodConstraints = record['sodConstraints'];
  }
  if (Array.isArray(record['previousApproverIds'])) {
    (input as { previousApproverIds?: unknown }).previousApproverIds =
      record['previousApproverIds'];
  }
  if (record['robotContext'] && typeof record['robotContext'] === 'object') {
    (input as { robotContext?: unknown }).robotContext = record['robotContext'];
  }

  const result = await submitApproval(commandDeps, auth.ctx, input);

  if (!result.ok) {
    approvalDecisionsTotal.inc({ status: 'error', workspaceId });
    if (result.error.kind === 'DependencyFailure') {
      args.log?.error('Approval decision dependency failure', {
        approvalId,
        workspaceId,
        error: result.error.message,
      });
    }
    respondProblem(res, submitErrorToProblem(result.error, pathname), correlationId, traceContext);
    return;
  }

  approvalDecisionsTotal.inc({ status: decision, workspaceId });

  // Broadcast approval decision to SSE event stream for real-time push
  if (deps.eventStream && !result.value.replayed) {
    const eventType =
      decision === 'Approved'
        ? 'com.portarium.approval.ApprovalGranted'
        : decision === 'Denied'
          ? 'com.portarium.approval.ApprovalDenied'
          : 'com.portarium.approval.ApprovalChangesRequested';
    deps.eventStream.publish({
      type: eventType,
      id: crypto.randomUUID(),
      workspaceId,
      time: new Date().toISOString(),
      data: { ...result.value, approvalId, decision },
    });
  }

  const { replayed: _replayed, ...responseBody } = result.value;
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: responseBody });
}
