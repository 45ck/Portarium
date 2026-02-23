/**
 * bead-0778: Retrieval and graph query HTTP handlers for the control-plane runtime.
 *
 * Exposes three workspace-scoped endpoints:
 *   POST /v1/workspaces/:workspaceId/retrieval/search  — semantic / graph / hybrid search
 *   POST /v1/workspaces/:workspaceId/graph/query       — graph traversal
 *   GET  /v1/workspaces/:workspaceId/derived-artifacts — list artifact metadata
 *
 * All routes enforce:
 *   1. JWT authentication (Bearer token) with workspace-claim validation
 *   2. Workspace-scope assertion (tenantId == workspaceId in URL)
 *   3. Read-access RBAC check
 *
 * When the required port is absent from deps the handler returns 503.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { WorkspaceId } from '../../domain/primitives/index.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  routeRetrievalQuery,
  type RetrievalStrategy,
  type SemanticQueryParams,
  type GraphQueryParams,
} from '../../application/services/retrieval-query-router.js';
import {
  type ControlPlaneDeps,
  authenticate,
  assertReadAccess,
  assertWorkspaceScope,
  readJsonBody,
  problemFromError,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

// ---------------------------------------------------------------------------
// Handler arg types
// ---------------------------------------------------------------------------

type RetrievalHandlerArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

// ---------------------------------------------------------------------------
// Body parsers
// ---------------------------------------------------------------------------

type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; message: string }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseStrategy(raw: unknown): ParseResult<RetrievalStrategy> {
  if (raw === 'semantic' || raw === 'graph' || raw === 'hybrid') return { ok: true, value: raw };
  return { ok: false, message: 'strategy must be "semantic", "graph", or "hybrid".' };
}

function parsePositiveInt(raw: unknown, field: string): ParseResult<number> {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw <= 0) {
    return { ok: false, message: `${field} must be a positive integer.` };
  }
  return { ok: true, value: raw };
}

function parseSemanticParams(raw: unknown): ParseResult<SemanticQueryParams> {
  const record = asRecord(raw);
  if (!record) return { ok: false, message: 'semantic params must be an object.' };

  if (typeof record['query'] !== 'string' || record['query'].length === 0) {
    return { ok: false, message: 'semantic.query must be a non-empty string.' };
  }

  const topK =
    record['topK'] !== undefined
      ? parsePositiveInt(record['topK'], 'topK')
      : { ok: true as const, value: 10 };
  if (!topK.ok) return topK;

  return {
    ok: true,
    value: {
      query: record['query'],
      topK: topK.value,
      ...(typeof record['minScore'] === 'number' ? { minScore: record['minScore'] } : {}),
      ...(asRecord(record['filters'])
        ? { filters: record['filters'] as Record<string, unknown> }
        : {}),
    },
  };
}

function parseGraphParams(raw: unknown): ParseResult<GraphQueryParams> {
  const record = asRecord(raw);
  if (!record) return { ok: false, message: 'graph params must be an object.' };

  if (typeof record['rootNodeId'] !== 'string' || record['rootNodeId'].length === 0) {
    return { ok: false, message: 'graph.rootNodeId must be a non-empty string.' };
  }

  const direction = record['direction'];
  if (direction !== 'outbound' && direction !== 'inbound' && direction !== 'both') {
    return { ok: false, message: 'graph.direction must be "outbound", "inbound", or "both".' };
  }

  const maxDepthResult =
    record['maxDepth'] !== undefined
      ? parsePositiveInt(record['maxDepth'], 'maxDepth')
      : { ok: true as const, value: 3 };
  if (!maxDepthResult.ok) return maxDepthResult;

  const relationFilter = record['relationFilter'];
  if (
    relationFilter !== undefined &&
    (!Array.isArray(relationFilter) || !relationFilter.every((r) => typeof r === 'string'))
  ) {
    return { ok: false, message: 'graph.relationFilter must be an array of strings.' };
  }

  return {
    ok: true,
    value: {
      rootNodeId: record['rootNodeId'],
      direction,
      maxDepth: maxDepthResult.value,
      ...(Array.isArray(relationFilter) ? { relationFilter } : {}),
    },
  };
}

type ParsedSearchBody =
  | { ok: false; message: string }
  | {
      ok: true;
      strategy: RetrievalStrategy;
      semantic?: SemanticQueryParams;
      graph?: GraphQueryParams;
    };

function parseSearchBody(body: unknown): ParsedSearchBody {
  const record = asRecord(body);
  if (!record) return { ok: false, message: 'Request body must be a JSON object.' };

  const strategyResult = parseStrategy(record['strategy']);
  if (!strategyResult.ok) return strategyResult;
  const strategy = strategyResult.value;

  let semantic: SemanticQueryParams | undefined;
  let graph: GraphQueryParams | undefined;

  if (strategy === 'semantic' || strategy === 'hybrid') {
    const sp = parseSemanticParams(record['semantic']);
    if (!sp.ok) return sp;
    semantic = sp.value;
  }

  if (strategy === 'graph') {
    const gp = parseGraphParams(record['graph']);
    if (!gp.ok) return gp;
    graph = gp.value;
  } else if (record['graph'] !== undefined) {
    // hybrid: graph enrichment is optional
    const gp = parseGraphParams(record['graph']);
    if (!gp.ok) return gp;
    graph = gp.value;
  }

  return { ok: true, strategy, ...(semantic ? { semantic } : {}), ...(graph ? { graph } : {}) };
}

type ParsedGraphBody = { ok: false; message: string } | { ok: true; graph: GraphQueryParams };

function parseGraphBody(body: unknown): ParsedGraphBody {
  const record = asRecord(body);
  if (!record) return { ok: false, message: 'Request body must be a JSON object.' };

  const gp = parseGraphParams(record);
  if (!gp.ok) return { ok: false, message: gp.message };
  return { ok: true, graph: gp.value };
}

// ---------------------------------------------------------------------------
// Auth + authz shared sequence
// ---------------------------------------------------------------------------

type AuthResult = { ok: false } | { ok: true; wsId: WorkspaceId };

async function authorizeRequest(args: RetrievalHandlerArgs): Promise<AuthResult> {
  const { deps, req, res, correlationId, pathname, workspaceId, traceContext } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return { ok: false };
  }

  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId, deps.authEventLogger);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return { ok: false };
  }

  const readCheck = await assertReadAccess(deps, auth.ctx);
  if (!readCheck.ok) {
    respondProblem(res, problemFromError(readCheck.error, pathname), correlationId, traceContext);
    return { ok: false };
  }

  return { ok: true, wsId: workspaceId as WorkspaceId };
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/retrieval/search
// ---------------------------------------------------------------------------

export async function handleRetrievalSearch(args: RetrievalHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext } = args;

  const authResult = await authorizeRequest(args);
  if (!authResult.ok) return;
  const { wsId } = authResult;

  if (
    deps.semanticIndexPort === undefined ||
    deps.knowledgeGraphPort === undefined ||
    deps.embeddingPort === undefined
  ) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Retrieval service is not configured for this deployment.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = await readJsonBody(req);
  const parsed = parseSearchBody(body);
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: parsed.message,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  try {
    const response = await routeRetrievalQuery(
      {
        semanticIndex: deps.semanticIndexPort,
        knowledgeGraph: deps.knowledgeGraphPort,
        embeddingPort: deps.embeddingPort,
      },
      {
        workspaceId: wsId,
        strategy: parsed.strategy,
        ...(parsed.semantic ? { semantic: parsed.semantic } : {}),
        ...(parsed.graph ? { graph: parsed.graph } : {}),
      },
    );

    respondJson(res, {
      statusCode: 200,
      correlationId,
      traceContext,
      body: {
        strategy: response.strategy,
        hits: response.hits,
        ...(response.graph ? { graph: response.graph } : {}),
      },
    });
  } catch (error) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Retrieval query failed.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
  }
}

// ---------------------------------------------------------------------------
// POST /v1/workspaces/:workspaceId/graph/query
// ---------------------------------------------------------------------------

export async function handleGraphQuery(args: RetrievalHandlerArgs): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext } = args;

  const authResult = await authorizeRequest(args);
  if (!authResult.ok) return;
  const { wsId } = authResult;

  if (deps.knowledgeGraphPort === undefined) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Graph service is not configured for this deployment.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const body = await readJsonBody(req);
  const parsed = parseGraphBody(body);
  if (!parsed.ok) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: parsed.message,
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  try {
    const result = await deps.knowledgeGraphPort.traverse({
      workspaceId: wsId,
      rootNodeId: parsed.graph.rootNodeId,
      direction: parsed.graph.direction,
      maxDepth: parsed.graph.maxDepth,
      ...(parsed.graph.relationFilter ? { relationFilter: parsed.graph.relationFilter } : {}),
    });

    respondJson(res, {
      statusCode: 200,
      correlationId,
      traceContext,
      body: { nodes: result.nodes, edges: result.edges },
    });
  } catch (error) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Graph traversal failed.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
  }
}

// ---------------------------------------------------------------------------
// GET /v1/workspaces/:workspaceId/derived-artifacts
// ---------------------------------------------------------------------------

export async function handleListDerivedArtifacts(
  args: RetrievalHandlerArgs & { url: URL },
): Promise<void> {
  const { deps, res, correlationId, pathname, traceContext } = args;

  const authResult = await authorizeRequest(args);
  if (!authResult.ok) return;
  const { wsId } = authResult;

  if (deps.derivedArtifactRegistryPort === undefined) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/service-unavailable',
        title: 'Service Unavailable',
        status: 503,
        detail: 'Derived artifact registry is not configured for this deployment.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const runId = args.url.searchParams.get('runId');
  if (runId === null || runId.length === 0) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'Query parameter "runId" is required.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
    return;
  }

  const kindFilter = args.url.searchParams.get('kind');

  try {
    const artifacts = await deps.derivedArtifactRegistryPort.findByRun(
      runId as Parameters<typeof deps.derivedArtifactRegistryPort.findByRun>[0],
      wsId,
    );

    const nowIso = new Date().toISOString();
    const filtered = artifacts.filter((a) => {
      // Skip expired artifacts
      if (a.expiresAtIso !== undefined && a.expiresAtIso < nowIso) return false;
      // Optionally filter by kind
      if (kindFilter !== null && a.kind !== kindFilter) return false;
      return true;
    });

    respondJson(res, {
      statusCode: 200,
      correlationId,
      traceContext,
      body: { items: filtered, total: filtered.length },
    });
  } catch (error) {
    respondProblem(
      res,
      {
        type: 'https://portarium.dev/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        detail: error instanceof Error ? error.message : 'Failed to list derived artifacts.',
        instance: pathname,
      },
      correlationId,
      traceContext,
    );
  }
}
