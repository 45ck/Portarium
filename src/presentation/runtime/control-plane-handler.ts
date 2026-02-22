import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { getRun } from '../../application/queries/get-run.js';
import { getWorkspace } from '../../application/queries/get-workspace.js';
import { checkRateLimit } from '../../application/services/rate-limit-guard.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import type { RateLimitScope } from '../../domain/rate-limiting/index.js';
import { TenantId } from '../../domain/primitives/index.js';
import type { RequestHandler } from './health-server.js';
import { buildControlPlaneDeps } from './control-plane-handler.bootstrap.js';
import {
  authenticate,
  checkIfMatch,
  computeETag,
  normalizeCorrelationId,
  normalizeTraceContext,
  problemFromError,
  respondJson,
  respondProblem,
  type ControlPlaneDeps,
} from './control-plane-handler.shared.js';
import {
  handleAgentHeartbeat,
  handleGetAgentWorkItems,
  handleMachineHeartbeat,
} from './control-plane-handler.agents.js';
import {
  handleListLocationEvents,
  handleListMapLayers,
  handleLocationEventsStream,
} from './control-plane-handler.location.js';
import {
  handleAssignHumanTask,
  handleCompleteHumanTask,
  handleEscalateHumanTask,
  handleGetHumanTask,
  handleGetWorkforceMember,
  handleListEvidence,
  handleListHumanTasks,
  handleListWorkforceMembers,
  handleListWorkforceQueues,
  handlePatchWorkforceAvailability,
} from './control-plane-handler.workforce.js';

type RequestContext = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
}>;

type WorkspaceHandlerArgs = RequestContext &
  Readonly<{
    workspaceId: string;
  }>;

type RunHandlerArgs = WorkspaceHandlerArgs &
  Readonly<{
    runId: string;
  }>;

type Route = Readonly<{
  method: 'GET' | 'PATCH' | 'POST';
  pattern: RegExp;
  handle: (match: RegExpExecArray, ctx: RequestContext) => Promise<void>;
}>;

async function handleGetWorkspace(args: WorkspaceHandlerArgs): Promise<void> {
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

  const result = await getWorkspace(
    { authorization: deps.authorization, workspaceStore: deps.workspaceStore },
    auth.ctx,
    { workspaceId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  const etag = computeETag(result.value);
  res.setHeader('ETag', etag);
  respondJson(res, {
    statusCode: 200,
    correlationId,
    traceContext,
    body: result.value,
  });
}

async function handleGetRun(args: RunHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId, runId } = args;
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

  const result = await getRun(
    { authorization: deps.authorization, runStore: deps.runStore },
    auth.ctx,
    { workspaceId, runId },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  const etag = computeETag(result.value);
  res.setHeader('ETag', etag);
  const precondition = checkIfMatch(req, etag);
  if (!precondition.ok) {
    respondProblem(
      res,
      problemFromError(precondition.error, pathname),
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

function decodePathSegment(match: RegExpExecArray, index: number): string {
  return decodeURIComponent(match[index] ?? '');
}

function workspaceArgs(match: RegExpExecArray, ctx: RequestContext): WorkspaceHandlerArgs {
  return { ...ctx, workspaceId: decodePathSegment(match, 1) };
}

function runArgs(match: RegExpExecArray, ctx: RequestContext): RunHandlerArgs {
  return { ...workspaceArgs(match, ctx), runId: decodePathSegment(match, 2) };
}

function workforceMemberArgs(
  match: RegExpExecArray,
  ctx: RequestContext,
): WorkspaceHandlerArgs & Readonly<{ workforceMemberId: string }> {
  return { ...workspaceArgs(match, ctx), workforceMemberId: decodePathSegment(match, 2) };
}

function humanTaskArgs(
  match: RegExpExecArray,
  ctx: RequestContext,
): WorkspaceHandlerArgs & Readonly<{ humanTaskId: string }> {
  return { ...workspaceArgs(match, ctx), humanTaskId: decodePathSegment(match, 2) };
}

function agentArgs(
  match: RegExpExecArray,
  ctx: RequestContext,
): WorkspaceHandlerArgs & Readonly<{ agentId: string }> {
  return { ...workspaceArgs(match, ctx), agentId: decodePathSegment(match, 2) };
}

function machineArgs(
  match: RegExpExecArray,
  ctx: RequestContext,
): WorkspaceHandlerArgs & Readonly<{ machineId: string }> {
  return { ...workspaceArgs(match, ctx), machineId: decodePathSegment(match, 2) };
}

const ROUTES: readonly Route[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)$/,
    handle: (m, c) => handleGetWorkspace(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/runs\/([^/]+)$/,
    handle: (m, c) => handleGetRun(runArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/location-events:stream$/,
    handle: (m, c) => handleLocationEventsStream(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/location-events$/,
    handle: (m, c) => handleListLocationEvents(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/map-layers$/,
    handle: (m, c) => handleListMapLayers(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/workforce$/,
    handle: (m, c) => handleListWorkforceMembers(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/workforce\/queues$/,
    handle: (m, c) => handleListWorkforceQueues(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/human-tasks$/,
    handle: (m, c) => handleListHumanTasks(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/evidence$/,
    handle: (m, c) => handleListEvidence(workspaceArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/workforce\/([^/]+)$/,
    handle: (m, c) => handleGetWorkforceMember(workforceMemberArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)$/,
    handle: (m, c) => handleGetHumanTask(humanTaskArgs(m, c)),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/workspaces\/([^/]+)\/agents\/([^/]+)\/work-items$/,
    handle: (m, c) => handleGetAgentWorkItems(agentArgs(m, c)),
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/workspaces\/([^/]+)\/workforce\/([^/]+)\/availability$/,
    handle: (m, c) => handlePatchWorkforceAvailability(workforceMemberArgs(m, c)),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/workspaces\/([^/]+)\/machines\/([^/]+)\/heartbeat$/,
    handle: (m, c) => handleMachineHeartbeat(machineArgs(m, c)),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/workspaces\/([^/]+)\/agents\/([^/]+)\/heartbeat$/,
    handle: (m, c) => handleAgentHeartbeat(agentArgs(m, c)),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/assign$/,
    handle: (m, c) => handleAssignHumanTask(humanTaskArgs(m, c)),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/complete$/,
    handle: (m, c) => handleCompleteHumanTask(humanTaskArgs(m, c)),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/workspaces\/([^/]+)\/human-tasks\/([^/]+)\/escalate$/,
    handle: (m, c) => handleEscalateHumanTask(humanTaskArgs(m, c)),
  },
];

async function dispatchRoute(ctx: RequestContext): Promise<boolean> {
  for (const route of ROUTES) {
    if (ctx.req.method !== route.method) continue;
    const match = route.pattern.exec(ctx.pathname);
    if (!match) continue;
    await route.handle(match, ctx);
    return true;
  }
  return false;
}

/**
 * Apply workspace-level rate limiting.
 * Returns true when the request was rejected and a 429 response was already sent.
 */
async function applyWorkspaceRateLimit(ctx: RequestContext): Promise<boolean> {
  const { deps, pathname, res, correlationId, traceContext } = ctx;
  if (!deps.rateLimitStore) return false;

  const rawId = decodeURIComponent(/^\/v1\/workspaces\/([^/]+)/.exec(pathname)?.[1] ?? '').trim();
  if (!rawId) return false;

  const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId(rawId) };
  const result = await checkRateLimit({ rateLimitStore: deps.rateLimitStore }, scope);

  if (!result.allowed) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: `Rate limit exceeded. Retry after ${result.retryAfterSeconds} seconds.`,
        instance: pathname,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      correlationId,
      traceContext,
    );
    return true;
  }

  // Record the allowed request against the window returned by the rate-limit check.
  await deps.rateLimitStore.recordRequest({
    scope,
    window: result.usage.window,
    nowIso: new Date().toISOString(),
  });
  return false;
}

async function handleRequest(
  deps: ControlPlaneDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const ctx: RequestContext = {
    deps,
    req,
    res,
    correlationId: normalizeCorrelationId(req),
    traceContext: normalizeTraceContext(req),
    pathname: new URL(req.url ?? '/', 'http://localhost').pathname,
  };

  if (await applyWorkspaceRateLimit(ctx)) return;

  const handled = await dispatchRoute(ctx);
  if (handled) return;

  respondProblem(
    res,
    {
      type: 'https://portarium.dev/problems/not-found',
      title: 'Not Found',
      status: 404,
      detail: 'Route not found.',
      instance: ctx.pathname,
    },
    ctx.correlationId,
    ctx.traceContext,
  );
}

export function createControlPlaneHandler(
  deps: ControlPlaneDeps = buildControlPlaneDeps(),
): RequestHandler {
  return (req, res) => {
    void handleRequest(deps, req, res).catch((error) => {
      const correlationId = randomUUID();
      const traceContext = normalizeTraceContext(req);
      respondProblem(
        res,
        {
          type: 'https://portarium.dev/problems/internal',
          title: 'Internal Server Error',
          status: 500,
          detail: error instanceof Error ? error.message : 'Unhandled error.',
          instance: req.url ?? '/',
        },
        correlationId,
        traceContext,
      );
    });
  };
}
