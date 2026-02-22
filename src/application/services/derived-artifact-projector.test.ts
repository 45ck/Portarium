/**
 * bead-0770: Contract tests for DerivedArtifactProjector.
 *
 * Verifies idempotency, checkpoint advancement, and artifact creation
 * using in-memory stubs for all port dependencies.
 */

import { describe, expect, it } from 'vitest';

import type {
  SemanticIndexPort,
  SemanticIndexEntry,
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
import type { Clock } from '../ports/clock.js';
import {
  projectEvidenceBatch,
  type EvidencePayload,
  type DerivedArtifactProjectorDeps,
  type ProjectorConfig,
} from './derived-artifact-projector.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

class StubSemanticIndex implements SemanticIndexPort {
  readonly entries = new Map<string, SemanticIndexEntry>();

  async upsert(entry: SemanticIndexEntry): Promise<void> {
    this.entries.set(entry.artifactId, entry);
  }
  async search() {
    return [] as const;
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
  async traverse(_params: GraphTraversalParams) {
    return { nodes: [...this.nodes.values()], edges: [...this.edges.values()] };
  }
  async deleteWorkspaceData(workspaceId: string): Promise<void> {
    for (const [id, n] of this.nodes) {
      if (n.workspaceId === workspaceId) this.nodes.delete(id);
    }
  }
  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  callCount = 0;
  async embed(_request: { text: string }) {
    this.callCount++;
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

  async save(artifact: ReturnType<typeof parseDerivedArtifactV1>): Promise<void> {
    this.artifacts.set(artifact.artifactId, artifact);
  }
  async findById(artifactId: string, _workspaceId: WorkspaceId) {
    return this.artifacts.get(artifactId);
  }
  async findByRun(runId: RunId, _workspaceId: WorkspaceId) {
    return [...this.artifacts.values()].filter((a) => a.provenance.runId === runId);
  }
  async saveCheckpoint(cp: ProjectionCheckpointV1): Promise<void> {
    this.checkpoints.set(`${cp.workspaceId}:${cp.runId}`, cp);
  }
  async loadCheckpoint(workspaceId: WorkspaceId, runId: RunId) {
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
// Helpers
// ---------------------------------------------------------------------------

function makeEvidence(
  evidenceId: string,
  workspaceId = 'ws-1' as WorkspaceId,
  runId = 'run-1' as RunId,
): EvidencePayload {
  return {
    evidenceId: evidenceId as any,
    workspaceId,
    runId,
    text: `evidence text for ${evidenceId}`,
    metadata: { source: 'test' },
    createdAtIso: '2026-02-22T00:00:00.000Z',
  };
}

function makeDeps(): DerivedArtifactProjectorDeps & {
  registry: StubRegistry;
  semanticIndex: StubSemanticIndex;
  knowledgeGraph: StubKnowledgeGraph;
  embeddingPort: StubEmbedding;
} {
  return {
    registry: new StubRegistry(),
    semanticIndex: new StubSemanticIndex(),
    knowledgeGraph: new StubKnowledgeGraph(),
    embeddingPort: new StubEmbedding(),
    clock: new StubClock(),
  };
}

const baseConfig: ProjectorConfig = {
  projectorVersion: '1.0.0',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('projectEvidenceBatch', () => {
  it('returns zeros for empty batch', async () => {
    const deps = makeDeps();
    const result = await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, []);
    expect(result).toEqual({ artifactsCreated: 0, evidenceProcessed: 0, skipped: 0 });
  });

  it('creates an embedding artifact and semantic index entry per evidence', async () => {
    const deps = makeDeps();
    const result = await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-1'),
    ]);
    expect(result.evidenceProcessed).toBe(1);
    expect(deps.semanticIndex.entries.has('emb:ws-1:ev-1')).toBe(true);
    expect(deps.registry.artifacts.has('emb:ws-1:ev-1')).toBe(true);
  });

  it('creates a graph node per evidence when buildGraphNodes is true', async () => {
    const deps = makeDeps();
    await projectEvidenceBatch(
      deps,
      { ...baseConfig, buildGraphNodes: true },
      'ws-1' as any,
      'run-1' as any,
      [makeEvidence('ev-2')],
    );
    expect(deps.knowledgeGraph.nodes.has('gnode:ws-1:ev-2')).toBe(true);
    expect(deps.registry.artifacts.has('gnode:ws-1:ev-2')).toBe(true);
  });

  it('skips graph nodes when buildGraphNodes is false', async () => {
    const deps = makeDeps();
    await projectEvidenceBatch(
      deps,
      { ...baseConfig, buildGraphNodes: false },
      'ws-1' as any,
      'run-1' as any,
      [makeEvidence('ev-3')],
    );
    expect(deps.knowledgeGraph.nodes.size).toBe(0);
  });

  it('advances the checkpoint to last processed evidenceId', async () => {
    const deps = makeDeps();
    await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-10'),
      makeEvidence('ev-11'),
    ]);
    const cp = await deps.registry.loadCheckpoint('ws-1' as any, 'run-1' as any);
    expect(cp?.lastProcessedEvidenceId).toBe('ev-11');
  });

  it('skips evidence already covered by checkpoint (idempotency)', async () => {
    const deps = makeDeps();
    // Pre-set checkpoint as if ev-5 was already processed
    await deps.registry.saveCheckpoint({
      workspaceId: 'ws-1' as any,
      runId: 'run-1' as any,
      lastProcessedEvidenceId: 'ev-5' as any,
      lastProcessedAtIso: '2026-02-22T00:00:00.000Z',
      projectorVersion: '1.0.0',
    });

    const result = await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-3'), // <= ev-5, should skip
      makeEvidence('ev-5'), // == ev-5, should skip
      makeEvidence('ev-6'), // > ev-5, should process
    ]);

    expect(result.skipped).toBe(2);
    expect(result.evidenceProcessed).toBe(1);
    expect(deps.embeddingPort.callCount).toBe(1);
  });

  it('upsert is idempotent: re-processing same evidence overwrites', async () => {
    const deps = makeDeps();
    const evidence = [makeEvidence('ev-20')];
    await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, evidence);
    // Clear checkpoint to allow re-processing
    deps.registry.checkpoints.clear();
    await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, evidence);
    // Should still be exactly 1 entry (upsert overwrites)
    expect(deps.semanticIndex.entries.size).toBe(1);
  });

  it('does not advance checkpoint when all evidence is skipped', async () => {
    const deps = makeDeps();
    await deps.registry.saveCheckpoint({
      workspaceId: 'ws-1' as any,
      runId: 'run-1' as any,
      lastProcessedEvidenceId: 'ev-99' as any,
      lastProcessedAtIso: '2026-02-22T00:00:00.000Z',
      projectorVersion: '1.0.0',
    });
    const result = await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-1'),
    ]);
    expect(result.skipped).toBe(1);
    // Checkpoint should remain at ev-99
    const cp = await deps.registry.loadCheckpoint('ws-1' as any, 'run-1' as any);
    expect(cp?.lastProcessedEvidenceId).toBe('ev-99');
  });

  it('counts artifacts correctly with graph enabled', async () => {
    const deps = makeDeps();
    const result = await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-a'),
      makeEvidence('ev-b'),
    ]);
    // Each evidence produces 2 artifacts (embedding + graph-node)
    expect(result.artifactsCreated).toBe(4);
  });

  it('semantic index entry includes embedding vector and metadata', async () => {
    const deps = makeDeps();
    await projectEvidenceBatch(deps, baseConfig, 'ws-1' as any, 'run-1' as any, [
      makeEvidence('ev-meta'),
    ]);
    const entry = deps.semanticIndex.entries.get('emb:ws-1:ev-meta');
    expect(entry?.vector).toEqual([0.1, 0.2, 0.3]);
    expect(entry?.metadata['embeddingModel']).toBe('stub-v1');
    expect(entry?.text).toBe('evidence text for ev-meta');
  });
});
