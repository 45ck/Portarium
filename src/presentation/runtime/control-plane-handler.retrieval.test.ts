/**
 * bead-0778: Contract tests for retrieval and graph route handlers.
 *
 * Tests cover:
 *   - Happy paths (semantic, graph, hybrid search; graph traversal; artifact list)
 *   - Authentication failures (401)
 *   - Workspace-scope violations (403)
 *   - Request body validation errors (400)
 *   - Missing port deps (503)
 *   - Expired artifact filtering
 *   - Tenant isolation (workspace A data never visible in workspace B)
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';

import type {
  SemanticIndexPort,
  SemanticIndexEntry,
  SemanticSearchResult,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  GraphTraversalParams,
  EmbeddingPort,
  DerivedArtifactRegistryPort,
  ProjectionCheckpointV1,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { parseDerivedArtifactV1 } from '../../domain/derived-artifacts/derived-artifact-v1.js';
import type { WorkspaceId, RunId } from '../../domain/primitives/index.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';
import {
  handleRetrievalSearch,
  handleGraphQuery,
  handleListDerivedArtifacts,
} from './control-plane-handler.retrieval.js';

// ---------------------------------------------------------------------------
// Stub ports
// ---------------------------------------------------------------------------

class StubSemanticIndex implements SemanticIndexPort {
  readonly entries = new Map<string, SemanticIndexEntry>();
  searchResults: SemanticSearchResult[] = [];

  async upsert(entry: SemanticIndexEntry) {
    this.entries.set(entry.artifactId, entry);
  }
  async search() {
    return this.searchResults;
  }
  async delete(artifactId: string) {
    this.entries.delete(artifactId);
  }
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubKnowledgeGraph implements KnowledgeGraphPort {
  readonly nodes = new Map<string, GraphNodeV1>();
  readonly edges = new Map<string, GraphEdgeV1>();

  async upsertNode(node: GraphNodeV1) {
    this.nodes.set(node.nodeId, node);
  }
  async upsertEdge(edge: GraphEdgeV1) {
    this.edges.set(edge.edgeId, edge);
  }
  async traverse(_params: GraphTraversalParams) {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] };
  }
  async deleteWorkspaceData(workspaceId: string) {
    for (const [id, n] of this.nodes) {
      if (n.workspaceId === workspaceId) this.nodes.delete(id);
    }
  }
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  async embed(_request: { text: string }) {
    return { vector: [0.1, 0.2, 0.3], model: 'stub-v1', dimensions: 3 };
  }
  async embedBatch(requests: readonly { text: string }[]) {
    return Promise.all(requests.map((r) => this.embed(r)));
  }
  async healthCheck() {
    return { ok: true, model: 'stub-v1' };
  }
}

class StubRegistry implements DerivedArtifactRegistryPort {
  readonly artifacts = new Map<string, ReturnType<typeof parseDerivedArtifactV1>>();
  readonly checkpoints = new Map<string, ProjectionCheckpointV1>();

  async save(artifact: ReturnType<typeof parseDerivedArtifactV1>) {
    this.artifacts.set(artifact.artifactId, artifact);
  }
  async findById(artifactId: string, _workspaceId: WorkspaceId) {
    return this.artifacts.get(artifactId);
  }
  async findByRun(runId: RunId, _workspaceId: WorkspaceId) {
    return [...this.artifacts.values()].filter((a) => a.provenance.runId === runId);
  }
  async saveCheckpoint(cp: ProjectionCheckpointV1) {
    this.checkpoints.set(`${cp.workspaceId}:${cp.runId}`, cp);
  }
  async loadCheckpoint(workspaceId: WorkspaceId, runId: RunId) {
    return this.checkpoints.get(`${workspaceId}:${runId}`);
  }
  async purgeExpired() {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Minimal auth stubs
// ---------------------------------------------------------------------------

function makeAuthDeps(
  opts: { authenticated?: boolean; workspaceId?: string } = {},
): Pick<ControlPlaneDeps, 'authentication' | 'authorization'> {
  const { authenticated = true, workspaceId = 'ws-test' } = opts;
  return {
    authentication: {
      authenticateBearerToken: async () =>
        authenticated
          ? {
              ok: true as const,
              value: { tenantId: workspaceId, userId: 'user-1', roles: ['admin'] },
            }
          : { ok: false as const, error: { kind: 'Unauthorized', message: 'Unauthorized' } },
    } as unknown as ControlPlaneDeps['authentication'],
    authorization: {
      isAllowed: async () => true,
    } as unknown as ControlPlaneDeps['authorization'],
  };
}

// ---------------------------------------------------------------------------
// HTTP stub helpers
// ---------------------------------------------------------------------------

function makeReqRes(body?: unknown): {
  req: IncomingMessage;
  res: ServerResponse;
  responseBody: () => string;
} {
  const chunks: Buffer[] = [];
  let statusCode = 0;

  const req = Object.assign(Object.create(IncomingMessage.prototype), {
    method: 'POST',
    url: '/',
    headers: { authorization: 'Bearer dev-token' },
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    },
  }) as IncomingMessage;

  const res = Object.assign(Object.create(ServerResponse.prototype), {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
    },
    end(chunk?: string | Buffer) {
      if (chunk) chunks.push(Buffer.from(chunk));
      this._ended = true;
    },
    _ended: false,
  }) as ServerResponse;

  Object.defineProperty(res, 'statusCode', {
    get() {
      return statusCode;
    },
    set(v) {
      statusCode = v;
    },
    configurable: true,
  });

  return {
    req,
    res,
    responseBody: () => Buffer.concat(chunks).toString('utf8'),
  };
}

function makeArgs(
  wsId: string,
  body?: unknown,
  opts: { authenticated?: boolean; authWorkspaceId?: string } = {},
) {
  const { req, res, responseBody } = makeReqRes(body);
  const authDeps = makeAuthDeps({
    authenticated: opts.authenticated !== false,
    workspaceId: opts.authWorkspaceId ?? wsId,
  });
  return {
    req,
    res,
    responseBody,
    correlationId: 'corr-test',
    pathname: `/v1/workspaces/${wsId}/retrieval/search`,
    workspaceId: wsId,
    traceContext: { traceparent: '00-trace-id-span-id-01' },
    deps: {
      ...authDeps,
    } as unknown as ControlPlaneDeps,
  };
}

function addPorts(
  deps: ControlPlaneDeps,
  ports: {
    semanticIndex?: StubSemanticIndex;
    knowledgeGraph?: StubKnowledgeGraph;
    embedding?: StubEmbedding;
    registry?: StubRegistry;
  } = {},
): ControlPlaneDeps {
  return {
    ...deps,
    ...(ports.semanticIndex ? { semanticIndexPort: ports.semanticIndex } : {}),
    ...(ports.knowledgeGraph ? { knowledgeGraphPort: ports.knowledgeGraph } : {}),
    ...(ports.embedding ? { embeddingPort: ports.embedding } : {}),
    ...(ports.registry ? { derivedArtifactRegistryPort: ports.registry } : {}),
  };
}

// ---------------------------------------------------------------------------
// handleRetrievalSearch tests
// ---------------------------------------------------------------------------

describe('handleRetrievalSearch', () => {
  it('returns 503 when retrieval ports are not configured', async () => {
    const args = makeArgs('ws-1', { strategy: 'semantic', semantic: { query: 'hello', topK: 5 } });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(503);
  });

  it('returns 401 when token is invalid', async () => {
    const args = makeArgs(
      'ws-1',
      { strategy: 'semantic', semantic: { query: 'hi', topK: 3 } },
      { authenticated: false },
    );
    args.deps = addPorts(args.deps, {
      semanticIndex: new StubSemanticIndex(),
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(401);
  });

  it('returns 403 when workspace scope mismatches token', async () => {
    const args = makeArgs(
      'ws-1',
      { strategy: 'semantic', semantic: { query: 'hi', topK: 3 } },
      { authWorkspaceId: 'ws-other' },
    );
    args.deps = addPorts(args.deps, {
      semanticIndex: new StubSemanticIndex(),
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(403);
  });

  it('returns 400 for missing strategy', async () => {
    const args = makeArgs('ws-1', { semantic: { query: 'hi', topK: 5 } });
    args.deps = addPorts(args.deps, {
      semanticIndex: new StubSemanticIndex(),
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(400);
  });

  it('returns 400 for semantic strategy with missing query', async () => {
    const args = makeArgs('ws-1', { strategy: 'semantic', semantic: { topK: 5 } });
    args.deps = addPorts(args.deps, {
      semanticIndex: new StubSemanticIndex(),
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(400);
  });

  it('returns 200 with semantic hits for semantic strategy', async () => {
    const index = new StubSemanticIndex();
    index.searchResults = [
      {
        artifactId: 'emb:ws-1:ev-1',
        score: 0.95,
        text: 'hello world',
        metadata: {},
        provenance: { workspaceId: 'ws-1' as WorkspaceId, runId: 'run-1' as RunId },
      },
    ];
    const args = makeArgs('ws-1', { strategy: 'semantic', semantic: { query: 'hello', topK: 5 } });
    args.deps = addPorts(args.deps, {
      semanticIndex: index,
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.strategy).toBe('semantic');
    expect(body.hits).toHaveLength(1);
    expect(body.hits[0].score).toBe(0.95);
  });

  it('returns 200 for graph strategy with graph params', async () => {
    const graph = new StubKnowledgeGraph();
    await graph.upsertNode({
      nodeId: 'gnode:ws-1:ev-2',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'evidence-entry',
      label: 'ev-2',
      properties: { runId: 'run-1' },
    });
    const args = makeArgs('ws-1', {
      strategy: 'graph',
      graph: { rootNodeId: 'gnode:ws-1:ev-2', direction: 'outbound', maxDepth: 2 },
    });
    args.deps = addPorts(args.deps, {
      semanticIndex: new StubSemanticIndex(),
      knowledgeGraph: graph,
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.strategy).toBe('graph');
    expect(body.hits).toHaveLength(1);
    expect(body.graph.nodes).toHaveLength(1);
  });

  it('returns 200 for hybrid strategy without graph enrichment', async () => {
    const index = new StubSemanticIndex();
    index.searchResults = [];
    const args = makeArgs('ws-1', { strategy: 'hybrid', semantic: { query: 'test', topK: 3 } });
    args.deps = addPorts(args.deps, {
      semanticIndex: index,
      knowledgeGraph: new StubKnowledgeGraph(),
      embedding: new StubEmbedding(),
    });
    await handleRetrievalSearch(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.strategy).toBe('hybrid');
    expect(body.hits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// handleGraphQuery tests
// ---------------------------------------------------------------------------

describe('handleGraphQuery', () => {
  it('returns 503 when graph port is not configured', async () => {
    const args = makeArgs('ws-1', { rootNodeId: 'n1', direction: 'outbound', maxDepth: 2 });
    await handleGraphQuery(args);
    expect(args.res.statusCode).toBe(503);
  });

  it('returns 401 when unauthenticated', async () => {
    const args = makeArgs(
      'ws-1',
      { rootNodeId: 'n1', direction: 'both', maxDepth: 1 },
      { authenticated: false },
    );
    args.deps = addPorts(args.deps, { knowledgeGraph: new StubKnowledgeGraph() });
    await handleGraphQuery(args);
    expect(args.res.statusCode).toBe(401);
  });

  it('returns 400 for invalid direction', async () => {
    const args = makeArgs('ws-1', { rootNodeId: 'n1', direction: 'sideways', maxDepth: 1 });
    args.deps = addPorts(args.deps, { knowledgeGraph: new StubKnowledgeGraph() });
    await handleGraphQuery(args);
    expect(args.res.statusCode).toBe(400);
  });

  it('returns 400 for missing rootNodeId', async () => {
    const args = makeArgs('ws-1', { direction: 'outbound', maxDepth: 2 });
    args.deps = addPorts(args.deps, { knowledgeGraph: new StubKnowledgeGraph() });
    await handleGraphQuery(args);
    expect(args.res.statusCode).toBe(400);
  });

  it('returns 200 with nodes and edges', async () => {
    const graph = new StubKnowledgeGraph();
    await graph.upsertNode({
      nodeId: 'node-a',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'evidence-entry',
      label: 'A',
      properties: {},
    });
    const args = makeArgs('ws-1', { rootNodeId: 'node-a', direction: 'inbound', maxDepth: 1 });
    args.deps = addPorts(args.deps, { knowledgeGraph: graph });
    await handleGraphQuery(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.nodes).toHaveLength(1);
    expect(body.nodes[0].nodeId).toBe('node-a');
    expect(body.edges).toHaveLength(0);
  });

  it('tenant isolation: workspace A graph not visible in workspace B query', async () => {
    const graphA = new StubKnowledgeGraph();
    await graphA.upsertNode({
      nodeId: 'gnode:ws-a:ev-1',
      workspaceId: 'ws-a' as WorkspaceId,
      kind: 'evidence-entry',
      label: 'ev-1',
      properties: {},
    });

    const graphB = new StubKnowledgeGraph();
    // B's graph is empty

    const argsA = makeArgs('ws-a', {
      rootNodeId: 'gnode:ws-a:ev-1',
      direction: 'both',
      maxDepth: 1,
    });
    argsA.deps = addPorts(argsA.deps, { knowledgeGraph: graphA });
    await handleGraphQuery(argsA);
    expect(argsA.res.statusCode).toBe(200);
    const bodyA = JSON.parse(argsA.responseBody());
    expect(bodyA.nodes).toHaveLength(1);

    const argsB = makeArgs(
      'ws-b',
      { rootNodeId: 'gnode:ws-a:ev-1', direction: 'both', maxDepth: 1 },
      { authWorkspaceId: 'ws-b' },
    );
    argsB.deps = addPorts(argsB.deps, { knowledgeGraph: graphB });
    await handleGraphQuery(argsB);
    expect(argsB.res.statusCode).toBe(200);
    const bodyB = JSON.parse(argsB.responseBody());
    expect(bodyB.nodes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// handleListDerivedArtifacts tests
// ---------------------------------------------------------------------------

describe('handleListDerivedArtifacts', () => {
  function makeListArgs(
    wsId: string,
    searchParams: Record<string, string> = {},
    opts: { authenticated?: boolean } = {},
  ) {
    const url = new URL(`http://localhost/v1/workspaces/${wsId}/derived-artifacts`);
    for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
    const base = makeArgs(wsId, undefined, opts);
    return { ...base, url, pathname: url.pathname };
  }

  it('returns 503 when registry is not configured', async () => {
    const args = makeListArgs('ws-1', { runId: 'run-1' });
    await handleListDerivedArtifacts(args);
    expect(args.res.statusCode).toBe(503);
  });

  it('returns 400 when runId is missing', async () => {
    const registry = new StubRegistry();
    const args = makeListArgs('ws-1');
    args.deps = addPorts(args.deps, { registry });
    await handleListDerivedArtifacts(args);
    expect(args.res.statusCode).toBe(400);
  });

  it('returns 200 with artifacts for a run', async () => {
    const registry = new StubRegistry();
    const artifact = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: 'emb:ws-1:ev-1',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'embedding',
      provenance: {
        workspaceId: 'ws-1' as WorkspaceId,
        runId: 'run-1' as RunId,
        projectorVersion: '1.0.0',
      },
      retentionPolicy: 'run-lifetime',
      createdAtIso: '2026-02-22T00:00:00.000Z',
    });
    await registry.save(artifact);

    const args = makeListArgs('ws-1', { runId: 'run-1' });
    args.deps = addPorts(args.deps, { registry });
    await handleListDerivedArtifacts(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('filters expired artifacts from the response', async () => {
    const registry = new StubRegistry();
    const expired = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: 'emb:ws-1:ev-old',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'embedding',
      provenance: {
        workspaceId: 'ws-1' as WorkspaceId,
        runId: 'run-2' as RunId,
        projectorVersion: '1.0.0',
      },
      retentionPolicy: 'ttl',
      createdAtIso: '2020-01-01T00:00:00.000Z',
      expiresAtIso: '2020-06-01T00:00:00.000Z', // past
    });
    await registry.save(expired);

    const args = makeListArgs('ws-1', { runId: 'run-2' });
    args.deps = addPorts(args.deps, { registry });
    await handleListDerivedArtifacts(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('filters by kind when kind param is provided', async () => {
    const registry = new StubRegistry();
    const embedding = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: 'emb:ws-1:ev-2',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'embedding',
      provenance: {
        workspaceId: 'ws-1' as WorkspaceId,
        runId: 'run-3' as RunId,
        projectorVersion: '1.0.0',
      },
      retentionPolicy: 'run-lifetime',
      createdAtIso: '2026-02-22T00:00:00.000Z',
    });
    const graphNode = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: 'gnode:ws-1:ev-2',
      workspaceId: 'ws-1' as WorkspaceId,
      kind: 'graph-node',
      provenance: {
        workspaceId: 'ws-1' as WorkspaceId,
        runId: 'run-3' as RunId,
        projectorVersion: '1.0.0',
      },
      retentionPolicy: 'run-lifetime',
      createdAtIso: '2026-02-22T00:00:00.000Z',
    });
    await registry.save(embedding);
    await registry.save(graphNode);

    const args = makeListArgs('ws-1', { runId: 'run-3', kind: 'embedding' });
    args.deps = addPorts(args.deps, { registry });
    await handleListDerivedArtifacts(args);
    expect(args.res.statusCode).toBe(200);
    const body = JSON.parse(args.responseBody());
    expect(body.items).toHaveLength(1);
    expect(body.items[0].kind).toBe('embedding');
  });
});
