import {
  authenticate,
  problemFromError,
  PROBLEM_TYPES,
  respondJson,
  respondProblem,
  type ControlPlaneDeps,
} from './control-plane-handler.shared.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import { getBeadDiff } from '../../application/queries/get-bead-diff.js';

type HandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: import('node:http').IncomingMessage;
  res: import('node:http').ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
  beadId: string;
}>;

const SAFE_BEAD_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export async function handleGetBeadDiff(args: HandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, beadId } = args;
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

  if (!deps.beadDiffStore) {
    respondProblem(
      res,
      {
        type: PROBLEM_TYPES.serviceUnavailable,
        title: 'Service Unavailable',
        status: 501,
        detail: 'Bead diff lookup is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  if (!SAFE_BEAD_ID.test(beadId)) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: 'beadId must be a safe identifier of 1-128 characters.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await getBeadDiff(
    { authorization: deps.authorization, beadDiffStore: deps.beadDiffStore },
    auth.ctx,
    { workspaceId, beadId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: result.value,
  });
}
