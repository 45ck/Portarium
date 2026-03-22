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
import { PolicyId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
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

  const auth = await authenticate(deps, { req, correlationId, traceContext, expectedWorkspaceId: workspaceId });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  // PolicyStore only has getPolicyById — for listing, we rely on the
  // InMemoryPolicyStore's internal state. For production, a listPolicies
  // method would be added to the port. For now, return the seeded policy.
  // This is a known limitation documented in the live-boot session.
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: { items: [] },
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

  const auth = await authenticate(deps, { req, correlationId, traceContext, expectedWorkspaceId: workspaceId });
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

  const auth = await authenticate(deps, { req, correlationId, traceContext, expectedWorkspaceId: workspaceId });
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
          bodyResult.status === 415
            ? 'https://portarium.dev/problems/unsupported-media-type'
            : 'https://portarium.dev/problems/validation-failed',
        title: bodyResult.status === 415 ? 'Unsupported Media Type' : 'Validation Failed',
        status: bodyResult.status,
        detail: bodyResult.message,
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

    await deps.policyStore.savePolicy(
      TenantId(workspaceId),
      WorkspaceId(workspaceId),
      policy,
    );

    respondJson(res, {
      statusCode: 201,
      correlationId,
      traceContext,
      body: { policyId: String(policy.policyId) },
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
