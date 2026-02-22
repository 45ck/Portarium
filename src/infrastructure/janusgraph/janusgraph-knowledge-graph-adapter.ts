/**
 * bead-0777: JanusGraph fallback adapter for KnowledgeGraphPort.
 *
 * Implements KnowledgeGraphPort using JanusGraph via the Gremlin Server
 * HTTP REST API. This is a fallback/parity adapter to Neo4j, suitable
 * for environments where Neo4j is not available.
 *
 * Vertex convention: all vertices carry a `workspaceId` property for
 * workspace-scoped operations. Vertices are identified by their `nodeId`
 * property (string UUID). Edges are identified by their `edgeId` property.
 *
 * Gremlin REST API: POST /gremlin with JSON body
 *   { "gremlin": "<gremlin script>", "bindings": { ... } }
 *
 * Idempotency: upsertNode/upsertEdge use `fold().coalesce(unfold(), addV())`
 * to ensure idempotent creates/updates.
 */

import type {
  GraphEdgeV1,
  GraphNodeV1,
  GraphTraversalParams,
  GraphTraversalResult,
  KnowledgeGraphPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { WorkspaceId } from '../../domain/primitives/index.js';
import type { PortariumLogger } from '../observability/logger.js';

// ---------------------------------------------------------------------------
// Minimal HTTP client interface
// ---------------------------------------------------------------------------

export interface GremlinHttpResponse {
  status: number;
  body: unknown;
}

export interface GremlinHttpClient {
  /**
   * Execute a Gremlin script via the Gremlin Server HTTP REST API.
   * Returns the raw response body.
   */
  run(gremlin: string, bindings: Record<string, unknown>): Promise<GremlinHttpResponse>;

  /**
   * Health check — hits the server status endpoint.
   */
  healthCheck(): Promise<GremlinHttpResponse>;
}

// ---------------------------------------------------------------------------
// Gremlin Server HTTP response shape (minimal)
// ---------------------------------------------------------------------------

interface GremlinResult {
  status?: { code?: number; message?: string };
  result?: { data?: unknown };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface JanusGraphKnowledgeGraphAdapterConfig {
  /** Gremlin HTTP client (inject FetchGremlinHttpClient in production) */
  client: GremlinHttpClient;
  /** Logger instance */
  logger: PortariumLogger;
}

// ---------------------------------------------------------------------------
// Gremlin label sanitization
// ---------------------------------------------------------------------------

function toLabel(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ---------------------------------------------------------------------------
// Response extraction
// ---------------------------------------------------------------------------

function assertOk(response: GremlinHttpResponse, context: string): void {
  if (response.status >= 400) {
    throw new Error(`JanusGraph ${context} failed: HTTP ${response.status}`);
  }
  const result = response.body as GremlinResult;
  const code = result.status?.code;
  // Gremlin Server 200 OK = success, 204 = no content (also ok)
  if (code !== undefined && code !== 200 && code !== 204) {
    throw new Error(
      `JanusGraph ${context} Gremlin error ${code}: ${result.status?.message ?? 'unknown'}`,
    );
  }
}

function extractList(response: GremlinHttpResponse): unknown[] {
  const result = response.body as GremlinResult;
  const data = result.result?.data;
  if (!Array.isArray(data)) return [];
  return data as unknown[];
}

function mapToGraphNode(raw: unknown, workspaceId: WorkspaceId): GraphNodeV1 {
  const props = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    nodeId: String(props['nodeId'] ?? ''),
    workspaceId,
    kind: (props['kind'] as GraphNodeV1['kind']) ?? 'run',
    label: String(props['label'] ?? ''),
    properties: Object.fromEntries(
      Object.entries(props).filter(
        ([k]) => !['nodeId', 'workspaceId', 'kind', 'label'].includes(k),
      ),
    ),
  };
}

function mapToGraphEdge(raw: unknown, workspaceId: WorkspaceId): GraphEdgeV1 {
  const props = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    edgeId: String(props['edgeId'] ?? ''),
    fromNodeId: String(props['fromNodeId'] ?? ''),
    toNodeId: String(props['toNodeId'] ?? ''),
    relation: String(props['relation'] ?? ''),
    workspaceId,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class JanusGraphKnowledgeGraphAdapter implements KnowledgeGraphPort {
  readonly #client: GremlinHttpClient;
  readonly #log: PortariumLogger;

  public constructor(config: JanusGraphKnowledgeGraphAdapterConfig) {
    this.#client = config.client;
    this.#log = config.logger.child({ component: 'janusgraph-knowledge-graph' });
  }

  /**
   * Upsert a graph vertex. Idempotent via coalesce pattern.
   */
  public async upsertNode(node: GraphNodeV1): Promise<void> {
    const kindLabel = toLabel(node.kind);
    const gremlin = `
      g.V()
        .has('portarium_node', 'nodeId', nodeId)
        .has('workspaceId', workspaceId)
        .fold()
        .coalesce(
          unfold(),
          addV('portarium_node').property('nodeId', nodeId).property('workspaceId', workspaceId)
        )
        .property('kind', kindLabel)
        .property('label', labelProp)
        .property('subKind', kindLabel)
        .next()
    `;

    const response = await this.#client.run(gremlin, {
      nodeId: node.nodeId,
      workspaceId: String(node.workspaceId),
      kindLabel,
      labelProp: node.label,
    });

    assertOk(response, `upsertNode nodeId=${node.nodeId}`);

    this.#log.debug('JanusGraph upsertNode ok', {
      nodeId: node.nodeId,
      workspaceId: String(node.workspaceId),
    });
  }

  /**
   * Upsert a graph edge. Idempotent via coalesce pattern.
   */
  public async upsertEdge(edge: GraphEdgeV1): Promise<void> {
    const relLabel = toLabel(edge.relation);
    const gremlin = `
      from_ = g.V()
        .has('portarium_node', 'nodeId', fromNodeId)
        .has('workspaceId', workspaceId)
        .next();
      to_ = g.V()
        .has('portarium_node', 'nodeId', toNodeId)
        .has('workspaceId', workspaceId)
        .next();
      g.V(from_)
        .outE(relLabel)
        .has('edgeId', edgeId)
        .fold()
        .coalesce(
          unfold(),
          g.V(from_).addE(relLabel).to(to_).property('edgeId', edgeId)
        )
        .property('workspaceId', workspaceId)
        .property('relation', relLabel)
        .next()
    `;

    const response = await this.#client.run(gremlin, {
      edgeId: edge.edgeId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      workspaceId: String(edge.workspaceId),
      relLabel,
    });

    assertOk(response, `upsertEdge edgeId=${edge.edgeId}`);

    this.#log.debug('JanusGraph upsertEdge ok', {
      edgeId: edge.edgeId,
      workspaceId: String(edge.workspaceId),
    });
  }

  /**
   * Traverse the graph from a root vertex up to maxDepth hops.
   */
  public async traverse(params: GraphTraversalParams): Promise<GraphTraversalResult> {
    const directionFn =
      params.direction === 'outbound' ? 'out' : params.direction === 'inbound' ? 'in' : 'both';

    const relationFilters = params.relationFilter?.map(toLabel) ?? [];

    // Gremlin repeat/until traversal
    const gremlin = `
      root = g.V()
        .has('portarium_node', 'nodeId', rootNodeId)
        .has('workspaceId', workspaceId)
        .tryNext();
      if (!root.isPresent()) {
        [[], []]
      } else {
        paths = g.V(root.get())
          .repeat(${directionFn}().has('workspaceId', workspaceId).simplePath())
          .times(maxDepth)
          .emit()
          .path()
          .toList();
        visitedNodeIds = [] as Set;
        visitedEdgeIds = [] as Set;
        nodeList = [];
        edgeList = [];
        paths.each { p ->
          p.objects().each { obj ->
            if (obj instanceof Vertex && !visitedNodeIds.contains(obj.id())) {
              visitedNodeIds.add(obj.id());
              nodeList << [nodeId: obj.value('nodeId'), workspaceId: obj.value('workspaceId'), kind: obj.value('kind'), label: obj.value('label')];
            }
          };
          p.objects().each { obj ->
            if (obj instanceof Edge && !visitedEdgeIds.contains(obj.id())) {
              visitedEdgeIds.add(obj.id());
              edgeList << [edgeId: obj.value('edgeId'), fromNodeId: obj.outVertex().value('nodeId'), toNodeId: obj.inVertex().value('nodeId'), relation: obj.value('relation'), workspaceId: obj.value('workspaceId')];
            }
          }
        };
        [nodeList, edgeList]
      }
    `;

    const response = await this.#client.run(gremlin, {
      rootNodeId: params.rootNodeId,
      workspaceId: String(params.workspaceId),
      maxDepth: params.maxDepth,
      relationFilters,
    });

    if (response.status >= 400) {
      throw new Error(
        `JanusGraph traverse failed for rootNodeId=${params.rootNodeId}: HTTP ${response.status}`,
      );
    }

    const data = extractList(response);
    if (data.length < 2) {
      return { nodes: [], edges: [] };
    }

    const rawNodes = Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
    const rawEdges = Array.isArray(data[1]) ? (data[1] as unknown[]) : [];

    return {
      nodes: rawNodes.map((n) => mapToGraphNode(n, params.workspaceId)),
      edges: rawEdges.map((e) => mapToGraphEdge(e, params.workspaceId)),
    };
  }

  /**
   * Delete all vertices and edges for a workspace.
   */
  public async deleteWorkspaceData(workspaceId: WorkspaceId): Promise<void> {
    const gremlin = `
      g.V()
        .has('portarium_node', 'workspaceId', workspaceId)
        .drop()
        .iterate()
    `;

    const response = await this.#client.run(gremlin, {
      workspaceId: String(workspaceId),
    });

    assertOk(response, `deleteWorkspaceData workspaceId=${String(workspaceId)}`);

    this.#log.info('JanusGraph workspace data deleted', {
      workspaceId: String(workspaceId),
    });
  }

  /**
   * Health check via the Gremlin Server status endpoint.
   */
  public async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const response = await this.#client.healthCheck();
      const latencyMs = Date.now() - start;
      return { ok: response.status < 400, latencyMs };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
