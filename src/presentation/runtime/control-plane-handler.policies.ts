/**
 * Policy CRUD HTTP handlers for the control-plane runtime.
 *
 * Endpoints:
 *   GET  /v1/workspaces/:workspaceId/policies           — list policies
 *   GET  /v1/workspaces/:workspaceId/policies/:policyId  — get policy
 *   POST /v1/workspaces/:workspaceId/policies            — create/update policy
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TraceContext } from '../../application/common/trace-context.js';
import { parsePolicyV1 } from '../../domain/policy/policy-v1.js';
import { PolicyId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  type ControlPlaneDeps,
  authenticate,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Handler argument types
// ---------------------------------------------------------------------------

type PolicyListArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

type PolicyItemArgs = PolicyListArgs &
  Readonly<{
    policyId: string;
  }>;

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/policies
// ---------------------------------------------------------------------------

export async function handleListPolicies(args: PolicyListArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  if (!deps.policyStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Policy store not configured.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
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

  if (!deps.policyStore.listPolicies) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Policy listing is not supported by the configured policy store.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const limitRaw = url.searchParams.get('limit');
  if (limitRaw !== null) {
    const parsedLimit = Number.parseInt(limitRaw, 10);
    if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const page = await deps.policyStore.listPolicies(
        auth.ctx.tenantId,
        WorkspaceId(workspaceId),
        { limit: parsedLimit, ...(cursor ? { cursor } : {}) },
      );
      respondJson(res, {
        statusCode: 200,
        correlationId,
        traceContext,
        body: page,
      });
      return;
    }
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'limit must be a positive integer.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const page = await deps.policyStore.listPolicies(auth.ctx.tenantId, WorkspaceId(workspaceId), {
    ...(cursor ? { cursor } : {}),
  });
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: page,
  });
}

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/policies/:policyId
// ---------------------------------------------------------------------------

export async function handleGetPolicy(args: PolicyItemArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, policyId } = args;

  if (!deps.policyStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Policy store not configured.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
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

  const policy = await deps.policyStore.getPolicyById(
    auth.ctx.tenantId,
    WorkspaceId(workspaceId),
    PolicyId(policyId),
  );

  if (!policy) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Policy ${policyId} not found.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: policy });
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/policies
// ---------------------------------------------------------------------------

export async function handleSavePolicy(args: PolicyListArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  if (!deps.policyStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Policy store not configured.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
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
        status: 400,
        detail: 'Request body must be a JSON object.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  try {
    const record = bodyResult.value as Record<string, unknown>;
    // Ensure workspaceId matches the URL
    const policyData = { ...record, workspaceId };
    const policy = parsePolicyV1(policyData);

    await deps.policyStore.savePolicy(auth.ctx.tenantId, WorkspaceId(workspaceId), policy);

    const policyId = String(policy.policyId);
    respondJson(res, {
      statusCode: 201,
      correlationId,
      traceContext,
      body: { policyId },
      location: `/v1/workspaces/${workspaceId}/policies/${policyId}`,
    });
  } catch (error) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: error instanceof Error ? error.message : 'Invalid policy data.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
  }
}
