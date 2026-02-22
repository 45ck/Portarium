/**
 * bead-0771: Tests for retrieval query router.
 */

import { describe, expect, it } from 'vitest';

import type {
  SemanticIndexPort,
  SemanticSearchParams,
  SemanticSearchResult,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  GraphTraversalParams,
  EmbeddingPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { WorkspaceId } from '../../domain/primitives/index.js';
import {
  routeRetrievalQuery,
  type RetrievalQueryRouterDeps,
} from './retrieval-query-router.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const STUB_RESULTS: SemanticSearchResult[] = [
  {
    artifactId: 'art-1',
    score: 0.95,
    text: 'approval granted',
    metadata: { source: 'test' },
    provenance: { workspaceId: 'ws-1' as any, runId: 'run-1' as any },
  },
];

class StubSemanticIndex implements SemanticIndexPort {
  lastParams: SemanticSearchParams | undefined;

  async upsert() {}
  async search(params: SemanticSearchParams): Promise<readonly SemanticSearchResult[]> {
    this.lastParams = params;
    return STUB_RESULTS;
  }
  async delete(_id: string, _ws: WorkspaceId) {}
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

const STUB_NODE: GraphNodeV1 = {
  nodeId: 'n-1',
  workspaceId: 'ws-1' as any,
  kind: 'evidence-entry',
  label: 'Evidence 1',
  properties: { runId: 'run-1' },
};

const STUB_EDGE: GraphEdgeV1 = {
  edgeId: 'e-1',
  fromNodeId: 'n-1',
  toNodeId: 'n-2',
  relation: 'TRIGGERED_BY',
  workspaceId: 'ws-1' as any,
};

class StubKnowledgeGraph implements KnowledgeGraphPort {
  async upsertNode() {}
  async upsertEdge() {}
  async traverse(_params: GraphTraversalParams) {
    return { nodes: [STUB_NODE], edges: [STUB_EDGE] };
  }
  async deleteWorkspaceData(_ws: string) {}
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  callCount = 0;
  async embed(_r: { text: string }) {
    this.callCount++;
    return { vector: [0.5, 0.5], model: 'stub', dimensions: 2 };
  }
  async embedBatch(rs: readonly { text: string }[]) {
    return Promise.all(rs.map((r) => this.embed(r)));
  }
  async healthCheck() {
    return { ok: true, model: 'stub' };
  }
}

function makeDeps(): RetrievalQueryRouterDeps & {
  semanticIndex: StubSemanticIndex;
  embeddingPort: StubEmbedding;
} {
  return {
    semanticIndex: new StubSemanticIndex(),
    knowledgeGraph: new StubKnowledgeGraph(),
    embeddingPort: new StubEmbedding(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('routeRetrievalQuery — semantic strategy', () => {
  it('returns semantic hits from index', async () => {
    const deps = makeDeps();
    const result = await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'semantic',
      semantic: { query: 'approval', topK: 5 },
    });
    expect(result.strategy).toBe('semantic');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.artifactId).toBe('art-1');
  });

  it('passes topK and filters to semantic index', async () => {
    const deps = makeDeps();
    await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'semantic',
      semantic: { query: 'test', topK: 10, filters: { kind: 'embedding' } },
    });
    expect(deps.semanticIndex.lastParams?.topK).toBe(10);
    expect(deps.semanticIndex.lastParams?.filters).toEqual({ kind: 'embedding' });
  });

  it('embeds the query text once', async () => {
    const deps = makeDeps();
    await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'semantic',
      semantic: { query: 'hello', topK: 3 },
    });
    expect(deps.embeddingPort.callCount).toBe(1);
  });

  it('throws if semantic params missing', async () => {
    const deps = makeDeps();
    await expect(
      routeRetrievalQuery(deps, { workspaceId: 'ws-1' as any, strategy: 'semantic' }),
    ).rejects.toThrow('semantic strategy requires semantic query params');
  });
});

describe('routeRetrievalQuery — graph strategy', () => {
  it('returns graph nodes as hits and graph result', async () => {
    const deps = makeDeps();
    const result = await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'graph',
      graph: { rootNodeId: 'n-1', direction: 'outbound', maxDepth: 2 },
    });
    expect(result.strategy).toBe('graph');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.artifactId).toBe('n-1');
    expect(result.graph?.edges).toContainEqual(STUB_EDGE);
  });

  it('throws if graph params missing', async () => {
    const deps = makeDeps();
    await expect(
      routeRetrievalQuery(deps, { workspaceId: 'ws-1' as any, strategy: 'graph' }),
    ).rejects.toThrow('graph strategy requires graph query params');
  });

  it('does not call embedding port for graph strategy', async () => {
    const deps = makeDeps();
    await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'graph',
      graph: { rootNodeId: 'n-1', direction: 'both', maxDepth: 1 },
    });
    expect(deps.embeddingPort.callCount).toBe(0);
  });
});

describe('routeRetrievalQuery — hybrid strategy', () => {
  it('returns semantic hits with no graph when graph params omitted', async () => {
    const deps = makeDeps();
    const result = await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'hybrid',
      semantic: { query: 'workflow', topK: 5 },
    });
    expect(result.strategy).toBe('hybrid');
    expect(result.hits).toHaveLength(1);
    expect(result.graph).toBeUndefined();
  });

  it('enriches with graph when graph params provided', async () => {
    const deps = makeDeps();
    const result = await routeRetrievalQuery(deps, {
      workspaceId: 'ws-1' as any,
      strategy: 'hybrid',
      semantic: { query: 'workflow', topK: 5 },
      graph: { rootNodeId: 'n-1', direction: 'outbound', maxDepth: 1 },
    });
    expect(result.graph?.nodes).toContainEqual(STUB_NODE);
  });

  it('throws if semantic params missing for hybrid', async () => {
    const deps = makeDeps();
    await expect(
      routeRetrievalQuery(deps, { workspaceId: 'ws-1' as any, strategy: 'hybrid' }),
    ).rejects.toThrow('hybrid strategy requires semantic query params');
  });
});
