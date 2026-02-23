import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { Hono } from 'hono';

import { getRun } from '../../application/queries/get-run.js';
import { getWorkspace } from '../../application/queries/get-workspace.js';
import { listRuns } from '../../application/queries/list-runs.js';
import { listWorkspaces } from '../../application/queries/list-workspaces.js';
import { checkRateLimit } from '../../application/services/rate-limit-guard.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import type { RateLimitScope } from '../../domain/rate-limiting/index.js';
import { TenantId } from '../../domain/primitives/index.js';
import type { RequestHandler } from './health-server.js';
import { buildControlPlaneDeps } from './control-plane-handler.bootstrap.js';
import {
  defaultRegistry,
  httpActiveConnections,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  rateLimitHitsTotal,
} from '../../infrastructure/observability/prometheus-registry.js';
import {
  assertReadAccess,
  authenticate,
  checkIfMatch,
  computeETag,
  normalizeCorrelationId,
  normalizeTraceContext,
  parseListQueryParams,
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
  handleListMachines,
  handleGetMachine,
  handleRegisterMachine,
  handleListAgents,
  handleGetAgent,
  handleCreateAgent,
} from './control-plane-handler.machines.js';
import {
  handleListLocationEvents,
  handleListMapLayers,
  handleLocationEventsStream,
} from './control-plane-handler.location.js';
import { handleEventsStream } from './control-plane-handler.events.js';
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

// ---------------------------------------------------------------------------
// Hono environment types
// ---------------------------------------------------------------------------

/** Node.js objects passed as Hono bindings via app.fetch(req, env). */
interface HonoBindings {
  incoming: IncomingMessage;
  outgoing: ServerResponse;
}

/**
 * Per-request context stored in Hono variables by the context-building
 * middleware and consumed by all route handlers.
 */
interface RequestContext {
  readonly deps: ControlPlaneDeps;
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly correlationId: string;
  readonly pathname: string;
  readonly traceContext: TraceContext;
}

type WorkspaceHandlerArgs = RequestContext & Readonly<{ workspaceId: string }>;
type RunHandlerArgs = WorkspaceHandlerArgs & Readonly<{ runId: string }>;

interface HonoEnv {
  Bindings: HonoBindings;
  Variables: { ctx: RequestContext };
}

// ---------------------------------------------------------------------------
// Route handler functions (unchanged from the original implementation)
// ---------------------------------------------------------------------------

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
  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
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

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

async function handleListWorkspaces(args: RequestContext): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext } = args;
  const auth = await authenticate(deps, { req, correlationId, traceContext });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  if (!deps.workspaceQueryStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Workspace listing is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const params = parseListQueryParams(url, ['name']);
  if (!params.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: params.error,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const result = await listWorkspaces(
    {
      authorization: deps.authorization,
      workspaceStore: deps.workspaceQueryStore,
      queryCache: deps.queryCache ?? null,
    },
    auth.ctx,
    {
      ...(params.value.limit !== undefined ? { limit: params.value.limit } : {}),
      ...(params.value.cursor ? { cursor: params.value.cursor } : {}),
      ...(params.value.search ? { nameQuery: params.value.search } : {}),
    },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

async function handleListRuns(args: WorkspaceHandlerArgs): Promise<void> {
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

  if (!deps.runQueryStore) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/not-implemented',
        title: 'Not Implemented',
        status: 501,
        detail: 'Run listing is not available in this configuration.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const params = parseListQueryParams(url, ['runId', 'status', 'createdAtIso', 'startedAtIso']);
  if (!params.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: params.error,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const rawStatus = url.searchParams.get('status') ?? undefined;
  const result = await listRuns(
    {
      authorization: deps.authorization,
      runStore: deps.runQueryStore,
      queryCache: deps.queryCache ?? null,
    },
    auth.ctx,
    {
      workspaceId,
      ...(params.value.limit !== undefined ? { limit: params.value.limit } : {}),
      ...(params.value.cursor ? { cursor: params.value.cursor } : {}),
      ...(params.value.search ? { search: params.value.search } : {}),
      ...(params.value.sort
        ? { sortField: params.value.sort.field, sortDirection: params.value.sort.direction }
        : {}),
      ...(rawStatus ? { status: rawStatus as never } : {}),
    },
  );
  if (!result.ok) {
    respondProblem(res, problemFromError(result.error, pathname), correlationId, traceContext);
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body: result.value });
}

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

/**
 * Builds the Hono routing app for the control plane.
 *
 * The app is used as a pure routing + middleware layer: route handlers write
 * HTTP responses directly to the Node.js `ServerResponse` via `respondJson` /
 * `respondProblem`, and the `Response` returned by `app.fetch()` is discarded
 * by the outer Node.js `RequestHandler`. See ADR-0097 for rationale.
 */
function buildRouter(deps: ControlPlaneDeps): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  // -------------------------------------------------------------------------
  // Middleware 1: build RequestContext
  // -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    const { incoming, outgoing } = c.env;
    const correlationId = normalizeCorrelationId(incoming);
    const traceContext = normalizeTraceContext(incoming);
    c.set('ctx', {
      deps,
      req: incoming,
      res: outgoing,
      correlationId,
      traceContext,
      pathname: c.req.path,
    });
    await next();
  });

  // -------------------------------------------------------------------------
  // Metrics endpoint — serve before other middleware to avoid auth overhead
  // -------------------------------------------------------------------------
  app.get('/metrics', (c) => {
    c.env.outgoing.statusCode = 200;
    c.env.outgoing.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    c.env.outgoing.end(defaultRegistry.format());
    return c.body(null);
  });

  // -------------------------------------------------------------------------
  // Middleware 2: request metrics (duration, count, active connections)
  // -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    const { outgoing } = c.env;
    httpActiveConnections.inc();
    const startMs = Date.now();
    outgoing.on('finish', () => {
      httpActiveConnections.dec();
      const durationSeconds = (Date.now() - startMs) / 1000;
      const route = c.req.routePath;
      const method = c.req.method;
      const status = String(outgoing.statusCode);
      httpRequestsTotal.inc({ method, route, status });
      httpRequestDurationSeconds.observe(durationSeconds, { method, route });
    });
    await next();
  });

  // -------------------------------------------------------------------------
  // Middleware 3: workspace-level rate limiting
  // -------------------------------------------------------------------------
  app.use('/v1/workspaces/*', async (c, next) => {
    const ctx = c.get('ctx');
    const { deps: d, res, correlationId, traceContext, pathname } = ctx;
    if (!d.rateLimitStore) {
      await next();
      return;
    }

    const rawId = decodeURIComponent(/^\/v1\/workspaces\/([^/]+)/.exec(pathname)?.[1] ?? '').trim();
    if (!rawId) {
      await next();
      return;
    }

    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId(rawId) };
    const result = await checkRateLimit({ rateLimitStore: d.rateLimitStore }, scope);

    if (!result.allowed) {
      rateLimitHitsTotal.inc({ workspaceId: rawId });
      d.authEventLogger?.logRateLimitExceeded({
        workspaceId: rawId,
        path: pathname,
        retryAfterSeconds: result.retryAfterSeconds,
      });
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
      // Do not call next() — response already written.
      return;
    }

    await d.rateLimitStore.recordRequest({
      scope,
      window: result.usage.window,
      nowIso: new Date().toISOString(),
    });
    await next();
  });

  // -------------------------------------------------------------------------
  // Routes
  //
  // More-specific paths are registered before generic parameterised ones so
  // that Hono's trie router matches them correctly (e.g. /workforce/queues
  // before /workforce/:workforceMemberId).
  //
  // The `location-events:stream` path uses a named-group RegExp because the
  // literal colon would otherwise be parsed as a Hono path parameter.
  // -------------------------------------------------------------------------

  // GET /v1/workspaces
  app.get('/v1/workspaces', async (c) => {
    const ctx = c.get('ctx');
    await handleListWorkspaces(ctx);
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId
  app.get('/v1/workspaces/:workspaceId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetWorkspace({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/runs
  app.get('/v1/workspaces/:workspaceId/runs', async (c) => {
    const ctx = c.get('ctx');
    await handleListRuns({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/runs/:runId
  app.get('/v1/workspaces/:workspaceId/runs/:runId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetRun({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      runId: c.req.param('runId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/events:stream   (workspace-scoped SSE stream)
  //
  // Same colon-in-path treatment as location-events:stream below.
  app.get('/v1/workspaces/:workspaceId/events:stream', async (c) => {
    const ctx = c.get('ctx');
    await handleEventsStream({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/location-events:stream   (SSE stream)
  //
  // The URL path contains a literal colon: `.../location-events:stream`.
  // Hono treats `:stream` in the string pattern as a path parameter that
  // captures everything after the `location-events` prefix.  At runtime the
  // captured value will be the literal string `:stream`, which is correct —
  // no other value would be sent by real clients.  The more specific pattern
  // (with the implicit non-empty capture) is registered first so it takes
  // precedence over the plain `location-events` route below.
  app.get('/v1/workspaces/:workspaceId/location-events:stream', async (c) => {
    const ctx = c.get('ctx');
    await handleLocationEventsStream({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/location-events
  app.get('/v1/workspaces/:workspaceId/location-events', async (c) => {
    const ctx = c.get('ctx');
    await handleListLocationEvents({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/map-layers
  app.get('/v1/workspaces/:workspaceId/map-layers', async (c) => {
    const ctx = c.get('ctx');
    await handleListMapLayers({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/workforce/queues  (before /:workforceMemberId)
  app.get('/v1/workspaces/:workspaceId/workforce/queues', async (c) => {
    const ctx = c.get('ctx');
    await handleListWorkforceQueues({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/workforce
  app.get('/v1/workspaces/:workspaceId/workforce', async (c) => {
    const ctx = c.get('ctx');
    await handleListWorkforceMembers({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/workforce/:workforceMemberId
  app.get('/v1/workspaces/:workspaceId/workforce/:workforceMemberId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetWorkforceMember({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      workforceMemberId: c.req.param('workforceMemberId'),
    });
    return c.body(null);
  });

  // PATCH /v1/workspaces/:workspaceId/workforce/:workforceMemberId/availability
  app.patch('/v1/workspaces/:workspaceId/workforce/:workforceMemberId/availability', async (c) => {
    const ctx = c.get('ctx');
    await handlePatchWorkforceAvailability({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      workforceMemberId: c.req.param('workforceMemberId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/human-tasks
  app.get('/v1/workspaces/:workspaceId/human-tasks', async (c) => {
    const ctx = c.get('ctx');
    await handleListHumanTasks({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/human-tasks/:humanTaskId
  app.get('/v1/workspaces/:workspaceId/human-tasks/:humanTaskId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetHumanTask({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      humanTaskId: c.req.param('humanTaskId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/human-tasks/:humanTaskId/assign
  app.post('/v1/workspaces/:workspaceId/human-tasks/:humanTaskId/assign', async (c) => {
    const ctx = c.get('ctx');
    await handleAssignHumanTask({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      humanTaskId: c.req.param('humanTaskId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/human-tasks/:humanTaskId/complete
  app.post('/v1/workspaces/:workspaceId/human-tasks/:humanTaskId/complete', async (c) => {
    const ctx = c.get('ctx');
    await handleCompleteHumanTask({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      humanTaskId: c.req.param('humanTaskId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/human-tasks/:humanTaskId/escalate
  app.post('/v1/workspaces/:workspaceId/human-tasks/:humanTaskId/escalate', async (c) => {
    const ctx = c.get('ctx');
    await handleEscalateHumanTask({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      humanTaskId: c.req.param('humanTaskId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/evidence
  app.get('/v1/workspaces/:workspaceId/evidence', async (c) => {
    const ctx = c.get('ctx');
    await handleListEvidence({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/machines
  app.get('/v1/workspaces/:workspaceId/machines', async (c) => {
    const ctx = c.get('ctx');
    await handleListMachines({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/machines/:machineId
  app.get('/v1/workspaces/:workspaceId/machines/:machineId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetMachine({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      machineId: c.req.param('machineId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/machines
  app.post('/v1/workspaces/:workspaceId/machines', async (c) => {
    const ctx = c.get('ctx');
    await handleRegisterMachine({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/agents
  app.get('/v1/workspaces/:workspaceId/agents', async (c) => {
    const ctx = c.get('ctx');
    await handleListAgents({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/agents/:agentId
  app.get('/v1/workspaces/:workspaceId/agents/:agentId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetAgent({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      agentId: c.req.param('agentId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/agents
  app.post('/v1/workspaces/:workspaceId/agents', async (c) => {
    const ctx = c.get('ctx');
    await handleCreateAgent({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/agents/:agentId/work-items
  app.get('/v1/workspaces/:workspaceId/agents/:agentId/work-items', async (c) => {
    const ctx = c.get('ctx');
    await handleGetAgentWorkItems({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      agentId: c.req.param('agentId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/machines/:machineId/heartbeat
  app.post('/v1/workspaces/:workspaceId/machines/:machineId/heartbeat', async (c) => {
    const ctx = c.get('ctx');
    await handleMachineHeartbeat({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      machineId: c.req.param('machineId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/agents/:agentId/heartbeat
  app.post('/v1/workspaces/:workspaceId/agents/:agentId/heartbeat', async (c) => {
    const ctx = c.get('ctx');
    await handleAgentHeartbeat({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      agentId: c.req.param('agentId'),
    });
    return c.body(null);
  });

  // -------------------------------------------------------------------------
  // 404 — no route matched
  // -------------------------------------------------------------------------
  app.notFound((c) => {
    const ctx = c.get('ctx');
    if (ctx) {
      respondProblem(
        ctx.res,
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
    return new Response(null);
  });

  // -------------------------------------------------------------------------
  // Unhandled error — last resort 500
  // -------------------------------------------------------------------------
  app.onError((error, c) => {
    const ctx = c.get('ctx');
    const correlationId = ctx?.correlationId ?? randomUUID();
    const traceContext = ctx?.traceContext ?? normalizeTraceContext(c.env.incoming);
    const pathname = ctx?.pathname ?? c.req.path;
    respondProblem(
      c.env.outgoing,
      {
        type: 'https://portarium.dev/problems/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Unhandled error.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return new Response(null);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Creates a Node.js `RequestHandler` backed by a Hono routing app.
 *
 * The Hono app is created once and reused across all requests.  Each request
 * is fed to `app.fetch()` as a minimal synthetic `Request` (method + URL
 * only); actual response-writing is performed as a side effect inside Hono
 * middleware/handlers via `respondJson` / `respondProblem`.  The `Response`
 * returned by `app.fetch()` is discarded.  See ADR-0097.
 */
export function createControlPlaneHandler(
  deps: ControlPlaneDeps = buildControlPlaneDeps(),
): RequestHandler {
  const app = buildRouter(deps);

  return (req, res) => {
    // Construct a minimal synthetic Request for Hono routing only.
    // The body is not needed because all body-reading happens from the raw
    // IncomingMessage inside route handlers via readJsonBody().
    const url = new URL(req.url ?? '/', 'http://localhost');
    const honoReq = new Request(url.toString(), { method: req.method ?? 'GET' });

    // app.fetch() may return a synchronous Response or a Promise<Response>;
    // wrap in Promise.resolve() to ensure .catch() is always available.
    void Promise.resolve(app.fetch(honoReq, { incoming: req, outgoing: res })).catch(
      (error: unknown) => {
        // Catastrophic failure — try to send a 500 if the response is still open.
        if (!res.writableEnded) {
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
        }
      },
    );
  };
}
