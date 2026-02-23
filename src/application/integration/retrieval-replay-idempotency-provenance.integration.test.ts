/**
 * bead-0781: Integration — end-to-end replay, idempotency, and provenance
 * verification suite for the Derived Artifacts + Retrieval campaign.
 *
 * Three suites:
 *  1. Projection replay — re-running the projector with identical evidence
 *     produces the same artifacts with no duplicates (upsert semantics).
 *  2. Retrieval idempotency — repeated queries with identical parameters
 *     return identical results for all three strategies (semantic, graph, hybrid).
 *  3. Provenance correctness — all hits carry workspaceId/runId/evidenceId
 *     provenance that matches the stored artifact, and cross-workspace hits
 *     are never returned.
 */

import { describe, expect, it, beforeEach } from 'vitest';

import type {
  SemanticIndexPort,
  SemanticIndexEntry,
  SemanticSearchParams,
  SemanticSearchResult,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  GraphTraversalParams,
  GraphTraversalResult,
  EmbeddingPort,
  DerivedArtifactRegistryPort,
  ProjectionCheckpointV1,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import type { DerivedArtifactV1 } from '../../domain/derived-artifacts/derived-artifact-v1.js';
import type { WorkspaceId, RunId } from '../../domain/primitives/index.js';
import type { Clock } from '../ports/clock.js';
import {
  projectEvidenceBatch,
  type EvidencePayload,
  type DerivedArtifactProjectorDeps,
  type ProjectorConfig,
} from '../services/derived-artifact-projector.js';
import {
  routeRetrievalQuery,
  type RetrievalQueryRouterDeps,
  type RetrievalRequest,
} from '../services/retrieval-query-router.js';

// ---------------------------------------------------------------------------
// In-memory stubs (self-contained — no shared state between tests)
// ---------------------------------------------------------------------------

class StubSemanticIndex implements SemanticIndexPort {
  readonly entries = new Map<string, SemanticIndexEntry>();

  async upsert(entry: SemanticIndexEntry): Promise<void> {
    this.entries.set(entry.artifactId, entry);
  }

  async search(params: SemanticSearchParams): Promise<readonly SemanticSearchResult[]> {
    return [...this.entries.values()]
      .filter((e) => e.workspaceId === params.workspaceId)
      .slice(0, params.topK)
      .map((e) => ({
        artifactId: e.artifactId,
        score: 0.9,
        text: e.text,
        metadata: e.metadata,
        provenance: {
          workspaceId: e.workspaceId,
          runId: e.runId,
          ...(e.evidenceId !== undefined ? { evidenceId: e.evidenceId } : {}),
        },
      }));
  }

  async delete(artifactId: string, _workspaceId: WorkspaceId): Promise<void> {
    this.entries.delete(artifactId);
  }

  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubKnowledgeGraph implements KnowledgeGraphPort {
  readonly nodes = new Map<string, GraphNodeV1>();
  readonly edges = new Map<string, GraphEdgeV1>();

  async upsertNode(node: GraphNodeV1): Promise<void> {
    this.nodes.set(node.nodeId, node);
  }

  async upsertEdge(edge: GraphEdgeV1): Promise<void> {
    this.edges.set(edge.edgeId, edge);
  }

  async traverse(params: GraphTraversalParams): Promise<GraphTraversalResult> {
    const matchingNodes = [...this.nodes.values()].filter(
      (n) => n.workspaceId === params.workspaceId,
    );
    const matchingEdges = [...this.edges.values()].filter(
      (e) => e.workspaceId === params.workspaceId,
    );
    return { nodes: matchingNodes, edges: matchingEdges };
  }

  async deleteWorkspaceData(workspaceId: string): Promise<void> {
    for (const [id, n] of this.nodes) {
      if (n.workspaceId === workspaceId) this.nodes.delete(id);
    }
    for (const [id, e] of this.edges) {
      if (e.workspaceId === workspaceId) this.edges.delete(id);
    }
  }

  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  callCount = 0;

  async embed(_request: { text: string }) {
    this.callCount += 1;
    return { vector: [0.1, 0.2, 0.3] as number[], model: 'stub-v1', dimensions: 3 };
  }

  async embedBatch(requests: readonly { text: string }[]) {
    return Promise.all(requests.map((r) => this.embed(r)));
  }

  async healthCheck() {
    return { ok: true, model: 'stub-v1' };
  }
}

class StubRegistry implements DerivedArtifactRegistryPort {
  readonly artifacts = new Map<string, DerivedArtifactV1>();
  readonly checkpoints = new Map<string, ProjectionCheckpointV1>();
  saveCallCount = 0;

  async save(artifact: DerivedArtifactV1): Promise<void> {
    this.saveCallCount += 1;
    this.artifacts.set(artifact.artifactId, artifact);
  }

  async findById(
    artifactId: string,
    _workspaceId: WorkspaceId,
  ): Promise<DerivedArtifactV1 | undefined> {
    return this.artifacts.get(artifactId);
  }

  async findByRun(runId: RunId, _workspaceId: WorkspaceId): Promise<readonly DerivedArtifactV1[]> {
    return [...this.artifacts.values()].filter((a) => a.provenance.runId === runId);
  }

  async saveCheckpoint(cp: ProjectionCheckpointV1): Promise<void> {
    this.checkpoints.set(`${cp.workspaceId}:${cp.runId}`, cp);
  }

  async loadCheckpoint(
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<ProjectionCheckpointV1 | undefined> {
    return this.checkpoints.get(`${workspaceId}:${runId}`);
  }

  async purgeExpired(): Promise<number> {
    return 0;
  }
}

class StubClock implements Clock {
  private iso: string;
  constructor(iso = '2026-02-22T00:00:00.000Z') {
    this.iso = iso;
  }
  nowIso() {
    return this.iso;
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const WS_A = 'ws-alpha' as WorkspaceId;
const WS_B = 'ws-beta' as WorkspaceId;
const RUN_1 = 'run-001' as RunId;
const RUN_2 = 'run-002' as RunId;

function makeEvidence(
  evidenceId: string,
  workspaceId: WorkspaceId = WS_A,
  runId: RunId = RUN_1,
): EvidencePayload {
  return {
    evidenceId: evidenceId as any,
    workspaceId,
    runId,
    text: `evidence content for ${evidenceId}`,
    metadata: { source: 'integration-test', evidenceId },
    createdAtIso: '2026-02-22T00:00:00.000Z',
  };
}

function makeProjectorDeps(overrides?: {
  registry?: StubRegistry;
  semanticIndex?: StubSemanticIndex;
  knowledgeGraph?: StubKnowledgeGraph;
  embeddingPort?: StubEmbedding;
}) {
  return {
    registry: overrides?.registry ?? new StubRegistry(),
    semanticIndex: overrides?.semanticIndex ?? new StubSemanticIndex(),
    knowledgeGraph: overrides?.knowledgeGraph ?? new StubKnowledgeGraph(),
    embeddingPort: overrides?.embeddingPort ?? new StubEmbedding(),
    clock: new StubClock(),
  } satisfies DerivedArtifactProjectorDeps & { clock: StubClock };
}

const BASE_CONFIG: ProjectorConfig = {
  projectorVersion: '1.0.0',
  embeddingModel: 'stub-v1',
  redactSecrets: false,
};

// ---------------------------------------------------------------------------
// Suite 1: Projection replay & idempotency
// ---------------------------------------------------------------------------

describe('Projection replay and idempotency', () => {
  it('projecting the same evidence batch twice creates the same artifacts (no duplicates)', async () => {
    const registry = new StubRegistry();
    const semanticIndex = new StubSemanticIndex();
    const deps = makeProjectorDeps({ registry, semanticIndex });
    const batch = [makeEvidence('evd-001'), makeEvidence('evd-002')];

    // First projection
    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);
    const countAfterFirst = registry.artifacts.size;
    const indexCountAfterFirst = semanticIndex.entries.size;

    // Replay identical batch
    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);

    // Artifact count must be the same — upsert semantics
    expect(registry.artifacts.size).toBe(countAfterFirst);
    expect(semanticIndex.entries.size).toBe(indexCountAfterFirst);
  });

  it('checkpoint advances to the last evidence ID in the batch', async () => {
    const registry = new StubRegistry();
    const deps = makeProjectorDeps({ registry });
    const batch = [makeEvidence('evd-010'), makeEvidence('evd-011'), makeEvidence('evd-012')];

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);

    const checkpoint = await registry.loadCheckpoint(WS_A, RUN_1);
    expect(checkpoint).toBeDefined();
    expect(checkpoint!.lastProcessedEvidenceId).toBe('evd-012');
    expect(checkpoint!.workspaceId).toBe(WS_A);
    expect(checkpoint!.runId).toBe(RUN_1);
    expect(checkpoint!.projectorVersion).toBe(BASE_CONFIG.projectorVersion);
  });

  it('replaying a batch produces the same artifact IDs', async () => {
    const registry = new StubRegistry();
    const deps = makeProjectorDeps({ registry });
    const batch = [makeEvidence('evd-020'), makeEvidence('evd-021')];

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);
    const idsAfterFirst = new Set(registry.artifacts.keys());

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);
    const idsAfterSecond = new Set(registry.artifacts.keys());

    expect(idsAfterFirst).toEqual(idsAfterSecond);
  });

  it('different evidence batches produce separate artifacts', async () => {
    const registry = new StubRegistry();
    const deps = makeProjectorDeps({ registry });

    const batchA = [makeEvidence('evd-030')];
    const batchB = [makeEvidence('evd-031')];

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batchA);
    const sizeAfterA = registry.artifacts.size;

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batchB);
    const sizeAfterB = registry.artifacts.size;

    expect(sizeAfterB).toBeGreaterThan(sizeAfterA);
  });

  it('projection artifacts carry correct provenance', async () => {
    const registry = new StubRegistry();
    const deps = makeProjectorDeps({ registry });
    const batch = [makeEvidence('evd-040', WS_A, RUN_2)];

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_2, batch);

    for (const artifact of registry.artifacts.values()) {
      expect(artifact.workspaceId).toBe(WS_A);
      expect(artifact.provenance.workspaceId).toBe(WS_A);
      expect(artifact.provenance.runId).toBe(RUN_2);
    }
  });

  it('artifacts are written to the semantic index with matching workspaceId and runId', async () => {
    const semanticIndex = new StubSemanticIndex();
    const deps = makeProjectorDeps({ semanticIndex });
    const batch = [makeEvidence('evd-050', WS_A, RUN_1)];

    await projectEvidenceBatch(deps, BASE_CONFIG, WS_A, RUN_1, batch);

    for (const entry of semanticIndex.entries.values()) {
      expect(entry.workspaceId).toBe(WS_A);
      expect(entry.runId).toBe(RUN_1);
      expect(entry.text).toBeTruthy();
      expect(entry.vector).toHaveLength(3); // stub returns [0.1, 0.2, 0.3]
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Retrieval search idempotency
// ---------------------------------------------------------------------------

describe('Retrieval search idempotency', () => {
  let semanticIndex: StubSemanticIndex;
  let knowledgeGraph: StubKnowledgeGraph;
  let embeddingPort: StubEmbedding;
  let routerDeps: RetrievalQueryRouterDeps;

  beforeEach(() => {
    semanticIndex = new StubSemanticIndex();
    knowledgeGraph = new StubKnowledgeGraph();
    embeddingPort = new StubEmbedding();
    routerDeps = { semanticIndex, knowledgeGraph, embeddingPort };

    // Seed the semantic index with two artifacts
    semanticIndex.entries.set('art-001', {
      artifactId: 'art-001',
      workspaceId: WS_A,
      runId: RUN_1,
      evidenceId: 'evd-001' as any,
      text: 'approval granted for deployment',
      vector: [0.1, 0.2, 0.3],
      metadata: { category: 'Approval' },
    });
    semanticIndex.entries.set('art-002', {
      artifactId: 'art-002',
      workspaceId: WS_A,
      runId: RUN_2,
      evidenceId: 'evd-002' as any,
      text: 'policy violation detected during run',
      vector: [0.4, 0.5, 0.6],
      metadata: { category: 'PolicyViolation' },
    });

    // Seed the graph with a node and an edge
    knowledgeGraph.nodes.set('run-001', {
      nodeId: 'run-001',
      workspaceId: WS_A,
      kind: 'run',
      label: 'Invoice Remediation',
      properties: { runId: RUN_1, status: 'Completed' },
    });
    knowledgeGraph.nodes.set('apr-001', {
      nodeId: 'apr-001',
      workspaceId: WS_A,
      kind: 'approval',
      label: 'Finance Approval',
      properties: { runId: RUN_1, status: 'Approved' },
    });
    knowledgeGraph.edges.set('edge-001', {
      edgeId: 'edge-001',
      fromNodeId: 'run-001',
      toNodeId: 'apr-001',
      relation: 'REQUIRES_APPROVAL',
      workspaceId: WS_A,
    });
  });

  it('repeated semantic queries return identical hit lists', async () => {
    const request: RetrievalRequest = {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'approval granted', topK: 10 },
    };

    const first = await routeRetrievalQuery(routerDeps, request);
    const second = await routeRetrievalQuery(routerDeps, request);

    expect(first.hits).toHaveLength(second.hits.length);
    for (let i = 0; i < first.hits.length; i++) {
      expect(first.hits[i]!.artifactId).toBe(second.hits[i]!.artifactId);
      expect(first.hits[i]!.score).toBe(second.hits[i]!.score);
    }
  });

  it('repeated graph queries return identical node and edge sets', async () => {
    const request: RetrievalRequest = {
      workspaceId: WS_A,
      strategy: 'graph',
      graph: { rootNodeId: 'run-001', direction: 'outbound', maxDepth: 3 },
    };

    const first = await routeRetrievalQuery(routerDeps, request);
    const second = await routeRetrievalQuery(routerDeps, request);

    expect(first.graph?.nodes.length).toBe(second.graph?.nodes.length);
    expect(first.graph?.edges.length).toBe(second.graph?.edges.length);
    expect(first.hits.length).toBe(second.hits.length);
  });

  it('repeated hybrid queries return identical results', async () => {
    const request: RetrievalRequest = {
      workspaceId: WS_A,
      strategy: 'hybrid',
      semantic: { query: 'deployment approval', topK: 5 },
      graph: { rootNodeId: 'run-001', direction: 'both', maxDepth: 2 },
    };

    const first = await routeRetrievalQuery(routerDeps, request);
    const second = await routeRetrievalQuery(routerDeps, request);

    expect(first.strategy).toBe('hybrid');
    expect(first.hits.length).toBe(second.hits.length);
    expect(first.graph?.nodes.length).toBe(second.graph?.nodes.length);
  });

  it('the embedding port is called once per semantic query (deterministic)', async () => {
    const request: RetrievalRequest = {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'test embedding determinism', topK: 3 },
    };

    const callsBefore = embeddingPort.callCount;
    await routeRetrievalQuery(routerDeps, request);
    const callsAfterFirst = embeddingPort.callCount;

    await routeRetrievalQuery(routerDeps, request);
    const callsAfterSecond = embeddingPort.callCount;

    expect(callsAfterFirst - callsBefore).toBe(1);
    expect(callsAfterSecond - callsAfterFirst).toBe(1);
  });

  it('semantic strategy returns no results when graph-only artifacts are seeded', async () => {
    // Index only has WS_A entries — a WS_B query should return nothing
    const request: RetrievalRequest = {
      workspaceId: WS_B,
      strategy: 'semantic',
      semantic: { query: 'approval', topK: 10 },
    };

    const result = await routeRetrievalQuery(routerDeps, request);
    expect(result.hits).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Provenance correctness
// ---------------------------------------------------------------------------

describe('Provenance correctness', () => {
  let semanticIndex: StubSemanticIndex;
  let knowledgeGraph: StubKnowledgeGraph;
  let embeddingPort: StubEmbedding;
  let routerDeps: RetrievalQueryRouterDeps;

  beforeEach(() => {
    semanticIndex = new StubSemanticIndex();
    knowledgeGraph = new StubKnowledgeGraph();
    embeddingPort = new StubEmbedding();
    routerDeps = { semanticIndex, knowledgeGraph, embeddingPort };

    // WS_A artifacts
    semanticIndex.entries.set('art-ws-a-001', {
      artifactId: 'art-ws-a-001',
      workspaceId: WS_A,
      runId: RUN_1,
      evidenceId: 'evd-a-001' as any,
      text: 'workspace alpha evidence entry',
      vector: [0.1, 0.2, 0.3],
      metadata: { workspace: 'alpha' },
    });
    semanticIndex.entries.set('art-ws-a-002', {
      artifactId: 'art-ws-a-002',
      workspaceId: WS_A,
      runId: RUN_2,
      text: 'another alpha entry without evidence link',
      vector: [0.2, 0.3, 0.4],
      metadata: { workspace: 'alpha' },
    });

    // WS_B artifacts — must never appear in WS_A queries
    semanticIndex.entries.set('art-ws-b-001', {
      artifactId: 'art-ws-b-001',
      workspaceId: WS_B,
      runId: 'run-b-001' as RunId,
      evidenceId: 'evd-b-001' as any,
      text: 'workspace beta evidence entry',
      vector: [0.9, 0.8, 0.7],
      metadata: { workspace: 'beta' },
    });

    // WS_A graph nodes
    knowledgeGraph.nodes.set('run-ws-a-001', {
      nodeId: 'run-ws-a-001',
      workspaceId: WS_A,
      kind: 'run',
      label: 'Alpha Run',
      properties: { runId: RUN_1 },
    });
    // WS_B graph node
    knowledgeGraph.nodes.set('run-ws-b-001', {
      nodeId: 'run-ws-b-001',
      workspaceId: WS_B,
      kind: 'run',
      label: 'Beta Run',
      properties: { runId: 'run-b-001' },
    });
  });

  it('semantic hits carry correct workspaceId in provenance', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'evidence entry', topK: 10 },
    });

    expect(result.hits.length).toBeGreaterThan(0);
    for (const hit of result.hits) {
      expect(hit.provenance.workspaceId).toBe(WS_A);
    }
  });

  it('semantic hits carry the correct runId from the stored artifact', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'alpha evidence', topK: 10 },
    });

    const hitA1 = result.hits.find((h) => h.artifactId === 'art-ws-a-001');
    const hitA2 = result.hits.find((h) => h.artifactId === 'art-ws-a-002');

    expect(hitA1?.provenance.runId).toBe(RUN_1);
    expect(hitA2?.provenance.runId).toBe(RUN_2);
  });

  it('semantic hits include evidenceId when the artifact was created from evidence', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'evidence', topK: 10 },
    });

    const hitWithEvidence = result.hits.find((h) => h.artifactId === 'art-ws-a-001');
    const hitWithoutEvidence = result.hits.find((h) => h.artifactId === 'art-ws-a-002');

    expect(hitWithEvidence?.provenance.evidenceId).toBe('evd-a-001');
    expect(hitWithoutEvidence?.provenance.evidenceId).toBeUndefined();
  });

  it('workspace B artifacts are never returned for workspace A queries', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'evidence entry', topK: 20 },
    });

    const betaHit = result.hits.find((h) => h.provenance.workspaceId === WS_B);
    expect(betaHit).toBeUndefined();

    const betaArtifactHit = result.hits.find((h) => h.artifactId === 'art-ws-b-001');
    expect(betaArtifactHit).toBeUndefined();
  });

  it('graph hits carry correct workspaceId in node provenance', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'graph',
      graph: { rootNodeId: 'run-ws-a-001', direction: 'outbound', maxDepth: 3 },
    });

    expect(result.graph?.nodes.length).toBeGreaterThan(0);
    for (const node of result.graph?.nodes ?? []) {
      expect(node.workspaceId).toBe(WS_A);
    }
  });

  it('graph query for workspace A does not return workspace B nodes', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'graph',
      graph: { rootNodeId: 'run-ws-a-001', direction: 'both', maxDepth: 5 },
    });

    const betaNode = result.graph?.nodes.find((n) => n.workspaceId === WS_B);
    expect(betaNode).toBeUndefined();
  });

  it('hybrid results combine semantic hits (with provenance) and graph nodes (workspace-scoped)', async () => {
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'hybrid',
      semantic: { query: 'alpha', topK: 10 },
      graph: { rootNodeId: 'run-ws-a-001', direction: 'outbound', maxDepth: 2 },
    });

    expect(result.strategy).toBe('hybrid');
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.graph).toBeDefined();

    for (const hit of result.hits) {
      expect(hit.provenance.workspaceId).toBe(WS_A);
    }
    for (const node of result.graph?.nodes ?? []) {
      expect(node.workspaceId).toBe(WS_A);
    }
  });

  it('end-to-end: project evidence then retrieve it with matching provenance', async () => {
    // Project evidence into the stores
    const projectorDeps: DerivedArtifactProjectorDeps = {
      registry: new StubRegistry(),
      semanticIndex,
      knowledgeGraph,
      embeddingPort,
      clock: new StubClock(),
    };
    const evidence = makeEvidence('evd-e2e-001', WS_A, RUN_1);
    await projectEvidenceBatch(projectorDeps, BASE_CONFIG, WS_A, RUN_1, [evidence]);

    // Retrieve via semantic search and verify provenance
    const result = await routeRetrievalQuery(routerDeps, {
      workspaceId: WS_A,
      strategy: 'semantic',
      semantic: { query: 'evidence content', topK: 10 },
    });

    // There should be at least one hit from our projected evidence
    const hit = result.hits.find((h) => h.provenance.evidenceId === 'evd-e2e-001');
    expect(hit).toBeDefined();
    expect(hit!.provenance.workspaceId).toBe(WS_A);
    expect(hit!.provenance.runId).toBe(RUN_1);
  });
});
