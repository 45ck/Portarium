/**
 * bead-0771: Application service — retrieval query routing and provenance assembly.
 *
 * Routes retrieval queries to the appropriate port (semantic, graph, or both)
 * and assembles results with provenance metadata for caller consumption.
 *
 * Strategy types:
 *   - semantic: pure vector search via SemanticIndexPort
 *   - graph:    graph traversal via KnowledgeGraphPort
 *   - hybrid:   semantic search + optional graph enrichment
 */

import type { WorkspaceId } from '../../domain/primitives/index.js';
import type {
  SemanticIndexPort,
  SemanticSearchResult,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  EmbeddingPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

export type RetrievalStrategy = 'semantic' | 'graph' | 'hybrid';

export type SemanticQueryParams = Readonly<{
  query: string;
  topK: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}>;

export type GraphQueryParams = Readonly<{
  rootNodeId: string;
  direction: 'outbound' | 'inbound' | 'both';
  maxDepth: number;
  relationFilter?: string[];
}>;

export type RetrievalRequest = Readonly<{
  workspaceId: WorkspaceId;
  strategy: RetrievalStrategy;
  semantic?: SemanticQueryParams;
  graph?: GraphQueryParams;
}>;

export type RetrievalHit = Readonly<{
  artifactId: string;
  score?: number;
  text?: string;
  metadata: Record<string, unknown>;
  provenance: {
    workspaceId: WorkspaceId;
    runId: string;
    evidenceId?: string;
  };
}>;

export type GraphResult = Readonly<{
  nodes: readonly GraphNodeV1[];
  edges: readonly GraphEdgeV1[];
}>;

export type RetrievalResponse = Readonly<{
  strategy: RetrievalStrategy;
  hits: readonly RetrievalHit[];
  graph?: GraphResult;
}>;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface RetrievalQueryRouterDeps {
  semanticIndex: SemanticIndexPort;
  knowledgeGraph: KnowledgeGraphPort;
  embeddingPort: EmbeddingPort;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Routes a retrieval request to the appropriate port(s) and returns
 * assembled results with provenance.
 *
 * Invariants:
 *  - 'semantic' strategy requires `request.semantic` params.
 *  - 'graph' strategy requires `request.graph` params.
 *  - 'hybrid' strategy requires `request.semantic`; `request.graph` is optional
 *    for graph enrichment of semantic hits.
 */
export async function routeRetrievalQuery(
  deps: RetrievalQueryRouterDeps,
  request: RetrievalRequest,
): Promise<RetrievalResponse> {
  const { strategy, workspaceId } = request;

  if (strategy === 'semantic') {
    return runSemanticQuery(deps, request);
  }

  if (strategy === 'graph') {
    return runGraphQuery(deps, request);
  }

  // hybrid
  return runHybridQuery(deps, request, workspaceId);
}

// ---------------------------------------------------------------------------
// Internal handlers
// ---------------------------------------------------------------------------

async function runSemanticQuery(
  deps: RetrievalQueryRouterDeps,
  request: RetrievalRequest,
): Promise<RetrievalResponse> {
  const params = request.semantic;
  if (params === undefined) {
    throw new Error('semantic strategy requires semantic query params');
  }

  // Embed the query text
  const { vector } = await deps.embeddingPort.embed({ text: params.query });

  const rawResults = await deps.semanticIndex.search({
    workspaceId: request.workspaceId,
    query: params.query,
    topK: params.topK,
    ...(params.minScore !== undefined ? { minScore: params.minScore } : {}),
    ...(params.filters !== undefined ? { filters: params.filters } : {}),
  });

  // Attach the vector to each hit metadata for caller transparency
  const hits = rawResults.map((r) => semanticResultToHit(r, vector));
  return { strategy: 'semantic', hits };
}

async function runGraphQuery(
  deps: RetrievalQueryRouterDeps,
  request: RetrievalRequest,
): Promise<RetrievalResponse> {
  const params = request.graph;
  if (params === undefined) {
    throw new Error('graph strategy requires graph query params');
  }

  const graphResult = await deps.knowledgeGraph.traverse({
    workspaceId: request.workspaceId,
    rootNodeId: params.rootNodeId,
    direction: params.direction,
    maxDepth: params.maxDepth,
    ...(params.relationFilter !== undefined ? { relationFilter: params.relationFilter } : {}),
  });

  // Convert nodes to retrieval hits for a uniform response shape
  const hits = graphResult.nodes.map((node) => nodeToHit(node));
  return { strategy: 'graph', hits, graph: graphResult };
}

async function runHybridQuery(
  deps: RetrievalQueryRouterDeps,
  request: RetrievalRequest,
  workspaceId: WorkspaceId,
): Promise<RetrievalResponse> {
  const params = request.semantic;
  if (params === undefined) {
    throw new Error('hybrid strategy requires semantic query params');
  }

  // Run semantic search
  const { vector } = await deps.embeddingPort.embed({ text: params.query });
  const rawResults = await deps.semanticIndex.search({
    workspaceId,
    query: params.query,
    topK: params.topK,
    ...(params.minScore !== undefined ? { minScore: params.minScore } : {}),
    ...(params.filters !== undefined ? { filters: params.filters } : {}),
  });

  const hits = rawResults.map((r) => semanticResultToHit(r, vector));

  // Optionally enrich with graph if graph params provided
  let graphResult: GraphResult | undefined;
  if (request.graph !== undefined) {
    const gp = request.graph;
    const traversal = await deps.knowledgeGraph.traverse({
      workspaceId,
      rootNodeId: gp.rootNodeId,
      direction: gp.direction,
      maxDepth: gp.maxDepth,
      ...(gp.relationFilter !== undefined ? { relationFilter: gp.relationFilter } : {}),
    });
    graphResult = traversal;
  }

  return { strategy: 'hybrid', hits, ...(graphResult !== undefined ? { graph: graphResult } : {}) };
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function semanticResultToHit(
  r: SemanticSearchResult,
  _queryVector: readonly number[],
): RetrievalHit {
  return {
    artifactId: r.artifactId,
    score: r.score,
    text: r.text,
    metadata: r.metadata,
    provenance: {
      workspaceId: r.provenance.workspaceId,
      runId: r.provenance.runId as string,
      ...(r.provenance.evidenceId !== undefined ? { evidenceId: r.provenance.evidenceId as string } : {}),
    },
  };
}

function nodeToHit(node: GraphNodeV1): RetrievalHit {
  return {
    artifactId: node.nodeId,
    metadata: { kind: node.kind, label: node.label, ...node.properties },
    provenance: {
      workspaceId: node.workspaceId,
      runId: (node.properties['runId'] as string) ?? '',
    },
  };
}
