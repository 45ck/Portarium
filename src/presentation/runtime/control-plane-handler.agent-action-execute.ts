/**
 * Agent action execute HTTP handler for the control-plane runtime.
 *
 * Endpoint:
 *   POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import {
  executeApprovedAgentAction,
  type ExecuteApprovedAgentActionDeps,
  type ExecuteApprovedAgentActionError,
} from '../../application/commands/execute-approved-agent-action.js';
import {
  type ControlPlaneDeps,
  type ProblemDetails,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Handler argument type
// ---------------------------------------------------------------------------

type ExecuteAgentActionArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
  approvalId: string;
}>;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function executeErrorToProblem(
  error: ExecuteApprovedAgentActionError,
  instance: string,
): ProblemDetails {
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
        detail: error.message,
        instance,
      };
  }
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute
// ---------------------------------------------------------------------------

export async function handleExecuteApprovedAgentAction(
  args: ExecuteAgentActionArgs,
): Promise<void> {
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

  if (!deps.actionRunner) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Action runner is not available in this configuration.',
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
  const flowRef = record['flowRef'];
  if (typeof flowRef !== 'string' || flowRef.trim() === '') {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'flowRef must be a non-empty string.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const commandDeps: ExecuteApprovedAgentActionDeps = {
    authorization: deps.authorization,
    clock: { nowIso: () => new Date().toISOString() },
    idGenerator: { generateId: () => crypto.randomUUID() },
    approvalStore: deps.approvalStore,
    unitOfWork: deps.unitOfWork ?? { execute: async (fn) => fn() },
    eventPublisher: deps.eventPublisher ?? {
      publish: async () => {
        /* noop stub */
      },
    },
    actionRunner: deps.actionRunner,
    ...(deps.evidenceLog ? { evidenceLog: deps.evidenceLog } : {}),
  };

  const payloadValue =
    record['payload'] && typeof record['payload'] === 'object'
      ? (record['payload'] as Record<string, unknown>)
      : undefined;

  const result = await executeApprovedAgentAction(commandDeps, auth.ctx, {
    workspaceId,
    approvalId,
    flowRef,
    ...(payloadValue !== undefined ? { payload: payloadValue } : {}),
  });

  if (!result.ok) {
    respondProblem(res, executeErrorToProblem(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}
