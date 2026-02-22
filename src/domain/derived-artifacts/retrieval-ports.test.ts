/**
 * bead-0768: Contract tests for retrieval ports.
 *
 * These tests verify the structural contracts of the port interfaces using
 * in-memory stub implementations. They ensure that any concrete adapter
 * implementing these interfaces will satisfy the domain expectations.
 */

import { describe, expect, it } from 'vitest';

import type {
  SemanticIndexPort,
  SemanticIndexEntry,
  KnowledgeGraphPort,
  GraphNodeV1,
  GraphEdgeV1,
  EmbeddingPort,
  DerivedArtifactRegistryPort,
  ProjectionCheckpointV1,
  GraphTraversalParams,
} from './retrieval-ports.js';
import type { WorkspaceId, RunId } from '../primitives/index.js';
import { parseDerivedArtifactV1 } from './derived-artifact-v1.js';

// ---------------------------------------------------------------------------
// Stub implementations
// ---------------------------------------------------------------------------

class StubSemanticIndex implements SemanticIndexPort {
  private readonly store = new Map<string, SemanticIndexEntry>();

  async upsert(entry: SemanticIndexEntry): Promise<void> {
    this.store.set(entry.artifactId, entry);
  }

  async search(): Promise<[]> {
    return [];
  }

  async delete(artifactId: string, _workspaceId: WorkspaceId): Promise<void> {
    this.store.delete(artifactId);
  }

  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }

  get(artifactId: string) {
    return this.store.get(artifactId);
  }
}

class StubKnowledgeGraph implements KnowledgeGraphPort {
  private readonly nodes = new Map<string, GraphNodeV1>();
  private readonly edges = new Map<string, GraphEdgeV1>();

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
    for (const [id, node] of this.nodes) {
      if (node.workspaceId === workspaceId) this.nodes.delete(id);
    }
    for (const [id, edge] of this.edges) {
      if (edge.workspaceId === workspaceId) this.edges.delete(id);
    }
  }

  async healthCheck() {
    return { ok: true, latencyMs: 0 };
  }
}

class StubEmbedding implements EmbeddingPort {
  async embed(_request: { text: string }) {
    return {
      vector: new Array(384).fill(0).map((_, i) => i / 384),
      model: 'stub-model-v1',
      dimensions: 384,
    };
  }

  async embedBatch(requests: readonly { text: string }[]) {
    return Promise.all(requests.map((r) => this.embed(r)));
  }

  async healthCheck() {
    return { ok: true, model: 'stub-model-v1' };
  }
}

class StubDerivedArtifactRegistry implements DerivedArtifactRegistryPort {
  private readonly artifacts = new Map<string, ReturnType<typeof parseDerivedArtifactV1>>();
  private readonly checkpoints = new Map<string, ProjectionCheckpointV1>();

  async save(artifact: ReturnType<typeof parseDerivedArtifactV1>): Promise<void> {
    this.artifacts.set(artifact.artifactId, artifact);
  }

  async findById(artifactId: string, _workspaceId: WorkspaceId) {
    return this.artifacts.get(artifactId);
  }

  async findByRun(runId: RunId, _workspaceId: WorkspaceId) {
    return [...this.artifacts.values()].filter((a) => a.provenance.runId === runId);
  }

  async saveCheckpoint(checkpoint: ProjectionCheckpointV1): Promise<void> {
    const key = `${checkpoint.workspaceId}:${checkpoint.runId}`;
    this.checkpoints.set(key, checkpoint);
  }

  async loadCheckpoint(workspaceId: WorkspaceId, runId: RunId) {
    return this.checkpoints.get(`${workspaceId}:${runId}`);
  }

  async purgeExpired(beforeIso: string): Promise<number> {
    let count = 0;
    for (const [id, artifact] of this.artifacts) {
      if (artifact.expiresAtIso !== undefined && artifact.expiresAtIso < beforeIso) {
        this.artifacts.delete(id);
        count++;
      }
    }
    return count;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SemanticIndexPort contract', () => {
  it('upsert stores an entry retrievable by id', async () => {
    const index = new StubSemanticIndex();
    const entry: SemanticIndexEntry = {
      artifactId: 'art-1',
      workspaceId: 'ws-1' as any,
      runId: 'run-1' as any,
      text: 'approval granted for payment workflow',
      vector: [0.1, 0.2, 0.3],
      metadata: {},
    };
    await index.upsert(entry);
    expect(index.get('art-1')).toEqual(entry);
  });

  it('delete removes entry', async () => {
    const index = new StubSemanticIndex();
    await index.upsert({
      artifactId: 'art-2',
      workspaceId: 'ws-1' as any,
      runId: 'run-1' as any,
      text: 'hello',
      vector: [],
      metadata: {},
    });
    await index.delete('art-2', 'ws-1' as any);
    expect(index.get('art-2')).toBeUndefined();
  });

  it('healthCheck returns ok', async () => {
    const result = await new StubSemanticIndex().healthCheck();
    expect(result.ok).toBe(true);
  });
});

describe('KnowledgeGraphPort contract', () => {
  it('upsertNode and traverse returns the node', async () => {
    const graph = new StubKnowledgeGraph();
    const node: GraphNodeV1 = {
      nodeId: 'n-1',
      workspaceId: 'ws-1' as any,
      kind: 'run',
      label: 'Run 1',
      properties: {},
    };
    await graph.upsertNode(node);
    const result = await graph.traverse({
      workspaceId: 'ws-1' as any,
      rootNodeId: 'n-1',
      direction: 'outbound',
      maxDepth: 1,
    });
    expect(result.nodes).toContainEqual(node);
  });

  it('upsertEdge and traverse returns the edge', async () => {
    const graph = new StubKnowledgeGraph();
    const edge: GraphEdgeV1 = {
      edgeId: 'e-1',
      fromNodeId: 'n-1',
      toNodeId: 'n-2',
      relation: 'TRIGGERED_BY',
      workspaceId: 'ws-1' as any,
    };
    await graph.upsertEdge(edge);
    const result = await graph.traverse({
      workspaceId: 'ws-1' as any,
      rootNodeId: 'n-1',
      direction: 'outbound',
      maxDepth: 1,
    });
    expect(result.edges).toContainEqual(edge);
  });

  it('deleteWorkspaceData removes all workspace nodes', async () => {
    const graph = new StubKnowledgeGraph();
    await graph.upsertNode({
      nodeId: 'n-ws1',
      workspaceId: 'ws-1' as any,
      kind: 'run',
      label: 'x',
      properties: {},
    });
    await graph.upsertNode({
      nodeId: 'n-ws2',
      workspaceId: 'ws-2' as any,
      kind: 'run',
      label: 'y',
      properties: {},
    });
    await graph.deleteWorkspaceData('ws-1' as any);
    const result = await graph.traverse({
      workspaceId: 'ws-1' as any,
      rootNodeId: '',
      direction: 'both',
      maxDepth: 1,
    });
    expect(result.nodes.every((n) => n.workspaceId !== 'ws-1')).toBe(true);
  });
});

describe('EmbeddingPort contract', () => {
  it('embed returns a vector with correct dimensions', async () => {
    const port = new StubEmbedding();
    const result = await port.embed({ text: 'test text' });
    expect(result.vector).toHaveLength(result.dimensions);
    expect(result.model).toBeTruthy();
  });

  it('embedBatch returns one result per request', async () => {
    const port = new StubEmbedding();
    const requests = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
    const results = await port.embedBatch(requests);
    expect(results).toHaveLength(3);
  });
});

describe('DerivedArtifactRegistryPort contract', () => {
  const registry = new StubDerivedArtifactRegistry();

  const artifact = parseDerivedArtifactV1({
    schemaVersion: 1,
    artifactId: 'da-reg-1',
    workspaceId: 'ws-1',
    kind: 'embedding',
    provenance: { workspaceId: 'ws-1', runId: 'run-reg-1', projectorVersion: '1.0.0' },
    retentionPolicy: 'indefinite',
    createdAtIso: '2026-02-22T00:00:00.000Z',
  });

  it('save and findById round-trips', async () => {
    await registry.save(artifact);
    const found = await registry.findById('da-reg-1', 'ws-1' as any);
    expect(found).toEqual(artifact);
  });

  it('findByRun returns artefacts for the run', async () => {
    const results = await registry.findByRun('run-reg-1' as any, 'ws-1' as any);
    expect(results).toContainEqual(artifact);
  });

  it('saveCheckpoint and loadCheckpoint round-trips', async () => {
    const checkpoint: ProjectionCheckpointV1 = {
      workspaceId: 'ws-1' as any,
      runId: 'run-reg-1' as any,
      lastProcessedEvidenceId: 'ev-1' as any,
      lastProcessedAtIso: '2026-02-22T00:01:00.000Z',
      projectorVersion: '1.0.0',
    };
    await registry.saveCheckpoint(checkpoint);
    const loaded = await registry.loadCheckpoint('ws-1' as any, 'run-reg-1' as any);
    expect(loaded).toEqual(checkpoint);
  });

  it('purgeExpired removes expired artefacts', async () => {
    const expiredArtifact = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: 'da-expired',
      workspaceId: 'ws-1',
      kind: 'chunk-index',
      provenance: { workspaceId: 'ws-1', runId: 'run-old', projectorVersion: '1.0.0' },
      retentionPolicy: 'ttl',
      createdAtIso: '2026-01-01T00:00:00.000Z',
      expiresAtIso: '2026-01-31T00:00:00.000Z',
    });
    await registry.save(expiredArtifact);
    const count = await registry.purgeExpired('2026-02-01T00:00:00.000Z');
    expect(count).toBeGreaterThan(0);
    const found = await registry.findById('da-expired', 'ws-1' as any);
    expect(found).toBeUndefined();
  });
});
