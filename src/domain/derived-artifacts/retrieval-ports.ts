/**
 * bead-0768: Domain/Application contracts for retrieval, graph projection,
 * embedding, and checkpoints.
 *
 * These are pure port interfaces — no infrastructure dependencies.
 * Adapters (Weaviate, Neo4j, OpenAI) implement these interfaces.
 */

import type { WorkspaceId, RunId, EvidenceId } from '../primitives/index.js';
import type { DerivedArtifactV1 } from './derived-artifact-v1.js';

// ---------------------------------------------------------------------------
// Projection checkpoint
// ---------------------------------------------------------------------------

/**
 * A ProjectionCheckpoint records how far the projection worker has processed
 * the evidence stream for a given workspace. Used for at-least-once delivery
 * with idempotent upserts.
 */
export type ProjectionCheckpointV1 = Readonly<{
  workspaceId: WorkspaceId;
  runId: RunId;
  lastProcessedEvidenceId: EvidenceId;
  lastProcessedAtIso: string;
  projectorVersion: string;
}>;

// ---------------------------------------------------------------------------
// Semantic index port (vector database)
// ---------------------------------------------------------------------------

export type SemanticIndexEntry = Readonly<{
  artifactId: string;
  workspaceId: WorkspaceId;
  runId: RunId;
  evidenceId?: EvidenceId;
  text: string; // source text that was embedded
  vector: readonly number[]; // dense vector
  metadata: Record<string, unknown>;
}>;

export type SemanticSearchResult = Readonly<{
  artifactId: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  provenance: {
    workspaceId: WorkspaceId;
    runId: RunId;
    evidenceId?: EvidenceId;
  };
}>;

export type SemanticSearchParams = Readonly<{
  workspaceId: WorkspaceId;
  query: string;
  topK: number;
  minScore?: number;
  filters?: Record<string, unknown>;
}>;

/**
 * Port for vector-based semantic search.
 * Implementations: WeaviateSemanticIndexAdapter, PgvectorSemanticIndexAdapter.
 */
export interface SemanticIndexPort {
  upsert(entry: SemanticIndexEntry): Promise<void>;
  search(params: SemanticSearchParams): Promise<readonly SemanticSearchResult[]>;
  delete(artifactId: string, workspaceId: WorkspaceId): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

// ---------------------------------------------------------------------------
// Graph projection port (graph database)
// ---------------------------------------------------------------------------

export type GraphNodeV1 = Readonly<{
  nodeId: string;
  workspaceId: WorkspaceId;
  kind: 'run' | 'work-item' | 'approval' | 'evidence-entry' | 'agent-machine';
  label: string;
  properties: Record<string, unknown>;
}>;

export type GraphEdgeV1 = Readonly<{
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string; // e.g. 'TRIGGERED_BY', 'REQUIRES_APPROVAL', 'PRODUCED_EVIDENCE'
  workspaceId: WorkspaceId;
  properties?: Record<string, unknown>;
}>;

export type GraphTraversalParams = Readonly<{
  workspaceId: WorkspaceId;
  rootNodeId: string;
  direction: 'outbound' | 'inbound' | 'both';
  maxDepth: number;
  relationFilter?: string[];
}>;

export type GraphTraversalResult = Readonly<{
  nodes: readonly GraphNodeV1[];
  edges: readonly GraphEdgeV1[];
}>;

/**
 * Port for graph projection and traversal.
 * Implementations: Neo4jGraphAdapter, InMemoryGraphAdapter.
 */
export interface KnowledgeGraphPort {
  upsertNode(node: GraphNodeV1): Promise<void>;
  upsertEdge(edge: GraphEdgeV1): Promise<void>;
  traverse(params: GraphTraversalParams): Promise<GraphTraversalResult>;
  deleteWorkspaceData(workspaceId: WorkspaceId): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

// ---------------------------------------------------------------------------
// Embedding port
// ---------------------------------------------------------------------------

export type EmbeddingRequest = Readonly<{
  text: string;
  model?: string; // optional model override
}>;

export type EmbeddingResponse = Readonly<{
  vector: readonly number[];
  model: string;
  dimensions: number;
}>;

/**
 * Port for computing dense vector embeddings.
 * Implementations: OpenAIEmbeddingAdapter, OnnxEmbeddingAdapter.
 */
export interface EmbeddingPort {
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  embedBatch(requests: readonly EmbeddingRequest[]): Promise<readonly EmbeddingResponse[]>;
  healthCheck(): Promise<{ ok: boolean; model: string }>;
}

// ---------------------------------------------------------------------------
// Derived artifact registry port (persistence)
// ---------------------------------------------------------------------------

/**
 * Port for persisting and querying DerivedArtifact metadata.
 * Implementation: Postgresql-backed registry (bead-0772).
 */
export interface DerivedArtifactRegistryPort {
  save(artifact: DerivedArtifactV1): Promise<void>;
  findById(artifactId: string, workspaceId: WorkspaceId): Promise<DerivedArtifactV1 | undefined>;
  findByRun(runId: RunId, workspaceId: WorkspaceId): Promise<readonly DerivedArtifactV1[]>;
  saveCheckpoint(checkpoint: ProjectionCheckpointV1): Promise<void>;
  loadCheckpoint(
    workspaceId: WorkspaceId,
    runId: RunId,
  ): Promise<ProjectionCheckpointV1 | undefined>;
  purgeExpired(beforeIso: string): Promise<number>; // returns count purged
}
