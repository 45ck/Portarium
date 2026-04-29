import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { APP_ACTIONS } from '../../application/common/actions.js';
import {
  routeProjectIntent,
  IntentRouterValidationError,
} from '../../application/services/intent-router.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  type ControlPlaneDeps,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type IntentArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

export async function handlePlanIntent(args: IntentArgs): Promise<void> {
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

  const allowed = await deps.authorization.isAllowed(auth.ctx, APP_ACTIONS.runStart);
  if (!allowed) {
    respondProblem(
      res,
      problemFromError(
        {
          kind: 'Forbidden',
          action: APP_ACTIONS.runStart,
          message: 'Caller is not permitted to plan new agent work.',
        },
        pathname,
      ),
      correlationId,
      traceContext,
    );
    return;
  }

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok || !bodyResult.value || typeof bodyResult.value !== 'object') {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/bad-request',
        title: 'Bad Request',
        status: bodyResult.ok ? 422 : 400,
        detail: 'Request body must be a JSON object with triggerText.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const record = bodyResult.value as Record<string, unknown>;
  try {
    const result = routeProjectIntent(
      {
        workspaceId,
        actorUserId: auth.ctx.principalId,
        triggerText: String(record['triggerText'] ?? ''),
        source:
          record['source'] === 'Ops' || record['source'] === 'Agent' ? record['source'] : 'Human',
        constraints: Array.isArray(record['constraints'])
          ? record['constraints'].filter((value): value is string => typeof value === 'string')
          : [],
      },
      {
        clock: { nowIso: () => (deps.clock ?? (() => new Date()))().toISOString() },
        idGenerator: { generateId: randomUUID },
      },
    );

    respondJson(res, { statusCode: 200, correlationId, traceContext, body: result });
  } catch (error) {
    if (error instanceof IntentRouterValidationError) {
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/validation-failed',
          title: 'Validation Failed',
          status: 422,
          detail: error.message,
          instance: pathname,
        },
        correlationId,
        traceContext,
      );
      return;
    }
    throw error;
  }
}
