import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import { Hono, type Context } from 'hono';

import { getRun } from '../../application/queries/get-run.js';
import { getWorkspace } from '../../application/queries/get-workspace.js';
import { listRuns } from '../../application/queries/list-runs.js';
import { listWorkspaces } from '../../application/queries/list-workspaces.js';
import { checkRateLimit } from '../../application/services/rate-limit-guard.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import type { RateLimitScope } from '../../domain/rate-limiting/index.js';
import type { RunStatus } from '../../domain/runs/index.js';
import { TenantId } from '../../domain/primitives/index.js';
import type { RequestHandler } from './health-server.js';
import {
  defaultRegistry,
  httpActiveConnections,
  httpRequestDurationSeconds,
  httpRequestsTotal,
  rateLimitHitsTotal,
} from '../../infrastructure/observability/prometheus-registry.js';
import { createLogger } from '../../infrastructure/observability/logger.js';
import { createRequestLogger } from '../../infrastructure/observability/request-logger.js';
import {
  PayloadTooLargeError,
  GENERIC_INTERNAL_ERROR_DETAIL,
  assertReadAccess,
  authenticate,
  checkIfMatch,
  checkIfNoneMatch,
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
import { handleBeadEventsStream, handleEventsStream } from './control-plane-handler.events.js';
import { handleGetBeadDiff } from './control-plane-handler.beads.js';
import {
  handleGraphQuery,
  handleListDerivedArtifacts,
  handleRetrievalSearch,
} from './control-plane-handler.retrieval.js';
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
import { handleProposeAgentAction } from './control-plane-handler.agent-actions.js';
import { handleExecuteApprovedAgentAction } from './control-plane-handler.agent-action-execute.js';
import { handlePlanIntent } from './control-plane-handler.intents.js';
import {
  handleDecideApproval,
  handleGetApproval,
  handleListApprovals,
} from './control-plane-handler.approvals.js';
import {
  handleGetPolicy,
  handleListPolicies,
  handleSavePolicy,
} from './control-plane-handler.policies.js';
import { handleGetCockpitExtensionContext } from './control-plane-handler.cockpit-extension-context.js';

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
  readonly log: import('../../infrastructure/observability/logger.js').PortariumLogger;
}

type WorkspaceHandlerArgs = RequestContext & Readonly<{ workspaceId: string }>;
type RunHandlerArgs = WorkspaceHandlerArgs & Readonly<{ runId: string }>;

interface HonoEnv {
  Bindings: HonoBindings;
  Variables: { ctx: RequestContext };
}

const MALFORMED_WORKSPACE_RATE_LIMIT_ID = '__malformed_workspace__';

function hasValidMetricsBearerToken(
  authorizationHeader: string | string[] | undefined,
  expectedToken: string,
): boolean {
  if (Array.isArray(authorizationHeader)) return false;

  const prefix = 'Bearer ';
  if (!authorizationHeader?.startsWith(prefix)) return false;

  const providedToken = authorizationHeader.slice(prefix.length).trim();
  if (!providedToken) return false;

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
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
  if (checkIfNoneMatch(req, etag)) {
    res.statusCode = 304;
    res.setHeader('x-correlation-id', correlationId);
    res.end();
    return;
  }
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
  if (checkIfNoneMatch(req, etag)) {
    res.statusCode = 304;
    res.setHeader('x-correlation-id', correlationId);
    res.end();
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
  const VALID_RUN_STATUSES: readonly RunStatus[] = [
    'Pending',
    'Running',
    'WaitingForApproval',
    'Paused',
    'Succeeded',
    'Failed',
    'Cancelled',
  ];
  if (rawStatus !== undefined && !VALID_RUN_STATUSES.includes(rawStatus as RunStatus)) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        detail: `status must be one of: ${VALID_RUN_STATUSES.join(', ')}.`,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }
  const validatedStatus: RunStatus | undefined = rawStatus as RunStatus | undefined;
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
      ...(validatedStatus ? { status: validatedStatus } : {}),
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
const rootLog = createLogger('control-plane');

function buildRouter(deps: ControlPlaneDeps): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  // -------------------------------------------------------------------------
  // Middleware 1: build RequestContext + request-scoped logger
  // -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    const { incoming, outgoing } = c.env;
    const correlationId = normalizeCorrelationId(incoming);
    const traceContext = normalizeTraceContext(incoming);
    const reqLog = createRequestLogger(rootLog, {
      correlationId,
      traceparent: traceContext.traceparent,
      method: incoming.method ?? 'GET',
      path: c.req.path,
    });
    c.set('ctx', {
      deps,
      req: incoming,
      res: outgoing,
      correlationId,
      traceContext,
      pathname: c.req.path,
      log: reqLog,
    });
    await next();
  });

  // -------------------------------------------------------------------------
  // CORS — allow cockpit dev server cross-origin requests (dev only)
  // -------------------------------------------------------------------------
  if (process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test') {
    const allowedOrigins = process.env['PORTARIUM_CORS_ALLOWED_ORIGINS']
      ?.split(',')
      .map((o) => o.trim());
    app.use('*', async (c, next) => {
      const { incoming, outgoing } = c.env;
      const origin = incoming.headers.origin;
      if (
        typeof origin === 'string' &&
        (allowedOrigins ? allowedOrigins.includes(origin) : false)
      ) {
        outgoing.setHeader('access-control-allow-origin', origin);
        outgoing.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, OPTIONS');
        outgoing.setHeader(
          'access-control-allow-headers',
          'authorization, content-type, x-correlation-id, traceparent, tracestate, if-match, if-none-match',
        );
        outgoing.setHeader('access-control-max-age', '86400');
      }
      if (incoming.method === 'OPTIONS') {
        outgoing.statusCode = 204;
        outgoing.end();
        return;
      }
      await next();
    });
  }

  // -------------------------------------------------------------------------
  // Security headers — CSP, HSTS, X-Content-Type-Options, X-Frame-Options
  // -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    const { outgoing } = c.env;
    outgoing.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    outgoing.setHeader('x-content-type-options', 'nosniff');
    outgoing.setHeader('x-frame-options', 'DENY');
    outgoing.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    outgoing.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env['NODE_ENV'] !== 'development' && process.env['NODE_ENV'] !== 'test') {
      outgoing.setHeader('strict-transport-security', 'max-age=63072000; includeSubDomains');
    }
    await next();
  });

  // -------------------------------------------------------------------------
  // Metrics endpoint — protected by PORTARIUM_METRICS_TOKEN bearer token.
  // If the env var is not set, the endpoint returns 403 to prevent accidental
  // exposure of workspace IDs, throughput, and approval rates.
  // Bind this port to an internal network interface in production.
  // -------------------------------------------------------------------------
  app.get('/metrics', (c) => {
    const metricsToken = process.env['PORTARIUM_METRICS_TOKEN']?.trim();
    if (!metricsToken) {
      c.env.outgoing.statusCode = 403;
      c.env.outgoing.setHeader('content-type', 'application/json');
      c.env.outgoing.end(
        JSON.stringify({
          error: 'Metrics endpoint requires PORTARIUM_METRICS_TOKEN to be configured',
        }),
      );
      return c.body(null);
    }
    if (!hasValidMetricsBearerToken(c.env.incoming.headers.authorization, metricsToken)) {
      c.env.outgoing.statusCode = 401;
      c.env.outgoing.setHeader('content-type', 'application/json');
      c.env.outgoing.end(JSON.stringify({ error: 'Invalid metrics token' }));
      return c.body(null);
    }
    c.env.outgoing.statusCode = 200;
    c.env.outgoing.setHeader('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    c.env.outgoing.end(defaultRegistry.format());
    return c.body(null);
  });

  // -------------------------------------------------------------------------
  // Middleware 2: request metrics + structured request logging
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

      const ctx = c.get('ctx');
      ctx.log.info('request completed', {
        status: outgoing.statusCode,
        durationMs: Math.round(durationSeconds * 1000),
        route,
      });
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

    const encodedWorkspaceId = /^\/v1\/workspaces\/([^/]*)/.exec(pathname)?.[1] ?? '';
    const rawId = decodeURIComponent(encodedWorkspaceId).trim();
    const rateLimitId = rawId || MALFORMED_WORKSPACE_RATE_LIMIT_ID;

    const scope: RateLimitScope = { kind: 'Tenant', tenantId: TenantId(rateLimitId) };
    const result = await checkRateLimit({ rateLimitStore: d.rateLimitStore }, scope);

    if (!result.allowed) {
      rateLimitHitsTotal.inc({ workspaceId: rateLimitId });
      d.authEventLogger?.logRateLimitExceeded({
        workspaceId: rateLimitId,
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

  // GET /v1/workspaces/:workspaceId/cockpit/extension-context
  app.get('/v1/workspaces/:workspaceId/cockpit/extension-context', async (c) => {
    const ctx = c.get('ctx');
    await handleGetCockpitExtensionContext({ ...ctx, workspaceId: c.req.param('workspaceId') });
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

  // GET /v1/workspaces/:workspaceId/beads/:beadId/events   (bead-scoped SSE stream)
  app.get('/v1/workspaces/:workspaceId/beads/:beadId/events', async (c) => {
    const ctx = c.get('ctx');
    await handleBeadEventsStream({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      beadId: c.req.param('beadId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/beads/:beadId/diff   (bead approval diff)
  app.get('/v1/workspaces/:workspaceId/beads/:beadId/diff', async (c) => {
    const ctx = c.get('ctx');
    await handleGetBeadDiff({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      beadId: c.req.param('beadId'),
    });
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

  // GET /v1/workspaces/:workspaceId/policies
  app.get('/v1/workspaces/:workspaceId/policies', async (c) => {
    const ctx = c.get('ctx');
    await handleListPolicies({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/policies/:policyId
  app.get('/v1/workspaces/:workspaceId/policies/:policyId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetPolicy({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      policyId: c.req.param('policyId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/policies
  app.post('/v1/workspaces/:workspaceId/policies', async (c) => {
    const ctx = c.get('ctx');
    await handleSavePolicy({ ...ctx, workspaceId: c.req.param('workspaceId') });
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
  app.post(
    '/v1/workspaces/:workspaceId/machines/:machineId/heartbeat',
    async (c: Context<HonoEnv>) => {
      const ctx = c.get('ctx');
      await handleMachineHeartbeat({
        ...ctx,
        workspaceId: c.req.param('workspaceId'),
        machineId: c.req.param('machineId'),
      });
      return c.body(null);
    },
  );

  // POST /v1/workspaces/:workspaceId/agents/:agentId/heartbeat
  app.post('/v1/workspaces/:workspaceId/agents/:agentId/heartbeat', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    await handleAgentHeartbeat({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      agentId: c.req.param('agentId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/retrieval/search
  app.post('/v1/workspaces/:workspaceId/retrieval/search', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    await handleRetrievalSearch({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/graph/query
  app.post('/v1/workspaces/:workspaceId/graph/query', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    await handleGraphQuery({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/derived-artifacts
  app.get('/v1/workspaces/:workspaceId/derived-artifacts', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    const url = new URL(c.req.url, 'http://localhost');
    await handleListDerivedArtifacts({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      url,
    });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/approvals/:approvalId/decide  (before /:approvalId)
  app.post('/v1/workspaces/:workspaceId/approvals/:approvalId/decide', async (c) => {
    const ctx = c.get('ctx');
    await handleDecideApproval({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      approvalId: c.req.param('approvalId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/approvals/:approvalId
  app.get('/v1/workspaces/:workspaceId/approvals/:approvalId', async (c) => {
    const ctx = c.get('ctx');
    await handleGetApproval({
      ...ctx,
      workspaceId: c.req.param('workspaceId'),
      approvalId: c.req.param('approvalId'),
    });
    return c.body(null);
  });

  // GET /v1/workspaces/:workspaceId/approvals
  app.get('/v1/workspaces/:workspaceId/approvals', async (c) => {
    const ctx = c.get('ctx');
    await handleListApprovals({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/agent-actions:propose
  app.post('/v1/workspaces/:workspaceId/agent-actions:propose', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    await handleProposeAgentAction({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/intents:plan
  app.post('/v1/workspaces/:workspaceId/intents:plan', async (c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    await handlePlanIntent({ ...ctx, workspaceId: c.req.param('workspaceId') });
    return c.body(null);
  });

  // POST /v1/workspaces/:workspaceId/agent-actions/:approvalId/execute
  app.post(
    '/v1/workspaces/:workspaceId/agent-actions/:approvalId/execute',
    async (c: Context<HonoEnv>) => {
      const ctx = c.get('ctx');
      await handleExecuteApprovedAgentAction({
        ...ctx,
        workspaceId: c.req.param('workspaceId'),
        approvalId: c.req.param('approvalId'),
      });
      return c.body(null);
    },
  );

  // -------------------------------------------------------------------------
  // 404 — no route matched
  // -------------------------------------------------------------------------
  app.notFound((c: Context<HonoEnv>) => {
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
  app.onError((error: Error, c: Context<HonoEnv>) => {
    const ctx = c.get('ctx');
    const correlationId = ctx?.correlationId ?? randomUUID();
    const traceContext = ctx?.traceContext ?? normalizeTraceContext(c.env.incoming);
    const pathname = ctx?.pathname ?? c.req.path;
    (ctx?.log ?? rootLog).error('Unhandled control-plane request error', {
      correlationId,
      path: pathname,
      error: error instanceof Error ? error.message : String(error),
    });
    respondProblem(
      c.env.outgoing,
      {
        type: 'https://portarium.dev/problems/internal',
        title: 'Internal Server Error',
        status: 500,
        detail: GENERIC_INTERNAL_ERROR_DETAIL,
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
export function createControlPlaneHandler(deps: ControlPlaneDeps): RequestHandler {
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
        // Try to send an error response if the response is still open.
        if (!res.writableEnded) {
          const correlationId = randomUUID();
          const traceContext = normalizeTraceContext(req);
          rootLog.error('Unhandled control-plane fetch error', {
            correlationId,
            path: req.url ?? '/',
            error: error instanceof Error ? error.message : String(error),
          });

          // Body size limit exceeded — 413 Payload Too Large.
          if (error instanceof PayloadTooLargeError) {
            respondProblem(
              res,
              {
                type: 'https://portarium.dev/problems/payload-too-large',
                title: 'Payload Too Large',
                status: 413,
                detail: error.message,
                instance: req.url ?? '/',
              },
              correlationId,
              traceContext,
            );
            return;
          }

          // Catastrophic failure — 500 Internal Server Error.
          respondProblem(
            res,
            {
              type: 'https://portarium.dev/problems/internal',
              title: 'Internal Server Error',
              status: 500,
              detail: GENERIC_INTERNAL_ERROR_DETAIL,
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
