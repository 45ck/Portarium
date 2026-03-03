/**
 * Agent action proposal HTTP handlers for the control-plane runtime.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  proposeAgentAction,
  type ProposeAgentActionError,
} from '../../application/commands/propose-agent-action.js';
import {
  type ControlPlaneDeps,
  type QueryError,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type AgentActionArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

function toQueryError(error: ProposeAgentActionError): QueryError {
  switch (error.kind) {
    case 'Forbidden':
    case 'ValidationFailed':
    case 'NotFound':
      return error;
    case 'Conflict':
      return {
        kind: 'ValidationFailed',
        message: error.message,
      };
    case 'DependencyFailure':
      return {
        kind: 'NotFound',
        resource: 'dependency',
        message: error.message,
      };
  }
}

export async function handleProposeAgentAction(args: AgentActionArgs): Promise<void> {
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

  const body = await readJsonBody(req);
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

  // Build minimal in-memory deps for the command
  const commandDeps = {
    authorization: deps.authorization,
    clock: { nowIso: () => new Date().toISOString() },
    idGenerator: { generateId: () => crypto.randomUUID() },
    unitOfWork: { execute: async (fn: () => Promise<void>) => fn() },
    policyStore: {
      getPolicyById: async () => null as never,
    },
    approvalStore: {
      getApprovalById: async () => null,
      saveApproval: async () => {},
    },
    eventPublisher: { publish: async () => {} },
    evidenceLog: {
      appendEntry: async (_tenantId: unknown, entry: unknown) => entry,
    },
  };

  const input: Record<string, unknown> = {
    workspaceId,
    agentId: String(record['agentId'] ?? ''),
    actionKind: String(record['actionKind'] ?? ''),
    toolName: String(record['toolName'] ?? ''),
    executionTier: String(record['executionTier'] ?? ''),
    policyIds: (record['policyIds'] as string[]) ?? [],
    rationale: String(record['rationale'] ?? ''),
    correlationId,
  };
  if (record['machineId']) input['machineId'] = String(record['machineId']);
  if (record['parameters']) input['parameters'] = record['parameters'];
  if (record['idempotencyKey']) input['idempotencyKey'] = String(record['idempotencyKey']);

  const result = await proposeAgentAction(commandDeps as never, auth.ctx, input as never);

  if (!result.ok) {
    respondProblem(
      res,
      problemFromError(toQueryError(result.error), pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, {
    statusCode: result.value.decision === 'Allow' ? 200 : 202,
    correlationId,
    traceContext,
    body: result.value,
  });
}
