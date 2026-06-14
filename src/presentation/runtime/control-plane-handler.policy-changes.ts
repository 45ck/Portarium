/**
 * Policy change workflow HTTP handlers for the control-plane runtime.
 *
 * Endpoints:
 *   GET  /v1/workspaces/:workspaceId/policy-changes
 *   GET  /v1/workspaces/:workspaceId/policy-changes/:policyChangeId
 *   POST /v1/workspaces/:workspaceId/policy-changes
 *   POST /v1/workspaces/:workspaceId/policy-changes/:policyChangeId/approve
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  approvePolicyChange,
  proposePolicyChange,
  type ApprovePolicyChangeInput,
  type PolicyChangeCommandError,
  type ProposePolicyChangeInput,
} from '../../application/commands/policy-change-workflow.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import type { PolicyStore } from '../../application/ports/policy-store.js';
import { PolicyChangeId, PolicyId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  type ControlPlaneDeps,
  GENERIC_DEPENDENCY_FAILURE_DETAIL,
  PROBLEM_TYPES,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
  type JsonBodyResult,
  type ProblemDetails,
} from './control-plane-handler.shared.js';

type PolicyChangeStore = PolicyStore &
  Required<
    Pick<
      PolicyStore,
      | 'listPolicyChanges'
      | 'getPolicyChangeById'
      | 'savePolicyChange'
      | 'appendPolicyChangeAuditEntry'
      | 'listPolicyChangeAuditEntries'
    >
  >;

type PolicyChangeListArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

type PolicyChangeItemArgs = PolicyChangeListArgs &
  Readonly<{
    policyChangeId: string;
  }>;

export async function handleListPolicyChanges(args: PolicyChangeListArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;
  const store = getPolicyChangeStore(deps);
  if (!store) {
    respondPolicyChangeStoreUnavailable(res, pathname, correlationId, traceContext);
    return;
  }

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

  const url = new URL(req.url ?? '/', 'http://localhost');
  const policyId = url.searchParams.get('policyId')?.trim();
  if (!policyId) {
    respondProblem(
      res,
      {
        type: PROBLEM_TYPES.validationFailed,
        title: 'Validation Failed',
        status: 400,
        detail: 'policyId query parameter is required.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const pagination = parsePagination(url, pathname);
  if (!pagination.ok) {
    respondProblem(res, pagination.problem, correlationId, traceContext);
    return;
  }

  const page = await store.listPolicyChanges(
    auth.ctx.tenantId,
    WorkspaceId(workspaceId),
    PolicyId(policyId),
    pagination.value,
  );
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: page });
}

export async function handleGetPolicyChange(args: PolicyChangeItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, policyChangeId } =
    args;
  const store = getPolicyChangeStore(deps);
  if (!store) {
    respondPolicyChangeStoreUnavailable(res, pathname, correlationId, traceContext);
    return;
  }

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

  const change = await store.getPolicyChangeById(
    auth.ctx.tenantId,
    WorkspaceId(workspaceId),
    PolicyChangeId(policyChangeId),
  );

  if (!change) {
    respondProblem(
      res,
      {
        type: PROBLEM_TYPES.notFound,
        title: 'Not Found',
        status: 404,
        detail: `Policy change ${policyChangeId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: change });
}

export async function handleProposePolicyChange(args: PolicyChangeListArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;
  const store = getPolicyChangeStore(deps);
  if (!store || !deps.unitOfWork || !deps.eventPublisher) {
    respondPolicyChangeStoreUnavailable(res, pathname, correlationId, traceContext);
    return;
  }

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

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    respondProblem(res, jsonBodyProblem(bodyResult, pathname), correlationId, traceContext);
    return;
  }
  if (
    !bodyResult.value ||
    typeof bodyResult.value !== 'object' ||
    Array.isArray(bodyResult.value)
  ) {
    respondProblem(
      res,
      {
        type: PROBLEM_TYPES.validationFailed,
        title: 'Validation Failed',
        status: 400,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await proposePolicyChange(
    {
      authorization: deps.authorization,
      clock: { nowIso: () => (deps.clock?.() ?? new Date()).toISOString() },
      idGenerator: { generateId: () => randomUUID() },
      policyStore: store,
      unitOfWork: deps.unitOfWork,
      eventPublisher: deps.eventPublisher,
      ...(deps.evidenceLog ? { evidenceLog: deps.evidenceLog } : {}),
    },
    auth.ctx,
    {
      ...(bodyResult.value as Record<string, unknown>),
      workspaceId,
    } as unknown as ProposePolicyChangeInput,
  );

  if (!result.ok) {
    respondProblem(
      res,
      policyChangeErrorToProblem(result.error, pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: result.value.status === 'Applied' ? 201 : 202,
    correlationId,
    traceContext,
    body: result.value,
    location: `/v1/workspaces/${workspaceId}/policy-changes/${String(result.value.policyChangeId)}`,
  });
}

export async function handleApprovePolicyChange(args: PolicyChangeItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, policyChangeId } =
    args;
  const store = getPolicyChangeStore(deps);
  if (!store || !deps.unitOfWork || !deps.eventPublisher) {
    respondPolicyChangeStoreUnavailable(res, pathname, correlationId, traceContext);
    return;
  }

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

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) {
    respondProblem(res, jsonBodyProblem(bodyResult, pathname), correlationId, traceContext);
    return;
  }
  if (
    !bodyResult.value ||
    typeof bodyResult.value !== 'object' ||
    Array.isArray(bodyResult.value)
  ) {
    respondProblem(
      res,
      {
        type: PROBLEM_TYPES.validationFailed,
        title: 'Validation Failed',
        status: 400,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await approvePolicyChange(
    {
      authorization: deps.authorization,
      clock: { nowIso: () => (deps.clock?.() ?? new Date()).toISOString() },
      idGenerator: { generateId: () => randomUUID() },
      policyStore: store,
      unitOfWork: deps.unitOfWork,
      eventPublisher: deps.eventPublisher,
      ...(deps.evidenceLog ? { evidenceLog: deps.evidenceLog } : {}),
    },
    auth.ctx,
    {
      ...(bodyResult.value as Record<string, unknown>),
      workspaceId,
      policyChangeId,
    } as unknown as ApprovePolicyChangeInput,
  );

  if (!result.ok) {
    respondProblem(
      res,
      policyChangeErrorToProblem(result.error, pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: result.value,
  });
}

function getPolicyChangeStore(deps: ControlPlaneDeps): PolicyChangeStore | null {
  const store = deps.policyStore;
  if (!store) return null;
  const maybe = store as Partial<PolicyChangeStore>;
  return typeof maybe.listPolicyChanges === 'function' &&
    typeof maybe.getPolicyChangeById === 'function' &&
    typeof maybe.savePolicyChange === 'function' &&
    typeof maybe.appendPolicyChangeAuditEntry === 'function' &&
    typeof maybe.listPolicyChangeAuditEntries === 'function'
    ? (store as PolicyChangeStore)
    : null;
}

function parsePagination(
  url: URL,
  pathname: string,
):
  | { ok: true; value: { limit?: number; cursor?: string } }
  | { ok: false; problem: ProblemDetails } {
  const limitRaw = url.searchParams.get('limit');
  const cursor = url.searchParams.get('cursor') ?? undefined;
  if (limitRaw === null) return { ok: true, value: { ...(cursor ? { cursor } : {}) } };
  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    return {
      ok: false,
      problem: {
        type: PROBLEM_TYPES.validationFailed,
        title: 'Validation Failed',
        status: 400,
        detail: 'limit must be a positive integer.',
        instance: pathname,
      },
    };
  }
  return { ok: true, value: { limit, ...(cursor ? { cursor } : {}) } };
}

function jsonBodyProblem(
  result: Extract<JsonBodyResult, { ok: false }>,
  pathname: string,
): ProblemDetails {
  return {
    type:
      result.error === 'unsupported-content-type'
        ? PROBLEM_TYPES.unsupportedMediaType
        : PROBLEM_TYPES.badRequest,
    title: result.error === 'unsupported-content-type' ? 'Unsupported Media Type' : 'Bad Request',
    status: result.error === 'unsupported-content-type' ? 415 : 400,
    detail:
      result.error === 'invalid-json'
        ? 'Request body contains invalid JSON.'
        : result.error === 'empty-body'
          ? 'Request body must not be empty.'
          : 'Content-Type must be application/json.',
    instance: pathname,
  };
}

function policyChangeErrorToProblem(
  error: PolicyChangeCommandError,
  instance: string,
): ProblemDetails {
  switch (error.kind) {
    case 'Forbidden':
    case 'ValidationFailed':
    case 'NotFound':
      return problemFromError(error, instance);
    case 'Conflict':
      return {
        type: PROBLEM_TYPES.conflict,
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

function respondPolicyChangeStoreUnavailable(
  res: ServerResponse,
  pathname: string,
  correlationId: string,
  traceContext: TraceContext,
): void {
  respondProblem(
    res,
    {
      type: PROBLEM_TYPES.serviceUnavailable,
      title: 'Service Unavailable',
      status: 503,
      detail: 'Policy change workflow dependencies are not configured.',
      instance: pathname,
    },
    correlationId,
    traceContext,
  );
}
