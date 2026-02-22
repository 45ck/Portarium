/**
 * bead-0770: Application service — derived-artifact projector.
 *
 * Orchestrates idempotent projection of evidence entries into derived
 * artifacts (embeddings, graph nodes/edges, chunk indices). Processes
 * evidence in order, maintains projection checkpoints, and delegates
 * to domain port interfaces for vector/graph/embedding operations.
 *
 * Idempotency contract:
 *   - Checkpoint records the last successfully processed evidenceId.
 *   - On restart the projector resumes after the checkpoint.
 *   - Each upsert to SemanticIndexPort and KnowledgeGraphPort is idempotent
 *     by artifactId/nodeId/edgeId (ports must honour upsert semantics).
 */

import type { WorkspaceId, RunId, EvidenceId } from '../../domain/primitives/index.js';
import type {
  DerivedArtifactRegistryPort,
  EmbeddingPort,
  KnowledgeGraphPort,
  SemanticIndexPort,
} from '../../domain/derived-artifacts/retrieval-ports.js';
import { parseDerivedArtifactV1 } from '../../domain/derived-artifacts/derived-artifact-v1.js';
import type { Clock } from '../ports/clock.js';
import { redactEvidenceText, redactMetadata } from './derived-artifact-redactor.js';

// ---------------------------------------------------------------------------
// Types used by callers
// ---------------------------------------------------------------------------

export type EvidencePayload = Readonly<{
  evidenceId: EvidenceId;
  workspaceId: WorkspaceId;
  runId: RunId;
  /**
   * Plain-text content to embed and index.
   * May be a serialised JSON string for structured evidence.
   */
  text: string;
  metadata: Record<string, unknown>;
  /** ISO-8601 timestamp when this evidence entry was created. */
  createdAtIso: string;
}>;

export type ProjectorConfig = Readonly<{
  /** Semantic string identifying the projector version (semver). */
  projectorVersion: string;
  /** Embedding model identifier passed through to EmbeddingPort. */
  embeddingModel?: string;
  /** Whether to build graph nodes for each evidence entry. Default true. */
  buildGraphNodes?: boolean;
  /**
   * Whether to redact secrets from evidence text and metadata before
   * sending to external indices (embeddings, graph, semantic search).
   * Default true. Set to false only in fully-isolated test environments.
   */
  redactSecrets?: boolean;
}>;

export type ProjectorResult = Readonly<{
  artifactsCreated: number;
  evidenceProcessed: number;
  skipped: number;
}>;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface DerivedArtifactProjectorDeps {
  registry: DerivedArtifactRegistryPort;
  semanticIndex: SemanticIndexPort;
  knowledgeGraph: KnowledgeGraphPort;
  embeddingPort: EmbeddingPort;
  clock: Clock;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Projects a batch of evidence payloads into derived artifacts.
 *
 * Returns counts of what was created/skipped. Idempotency is ensured
 * by the checkpoint: evidence with id <= lastProcessedEvidenceId is skipped.
 */
export async function projectEvidenceBatch(
  deps: DerivedArtifactProjectorDeps,
  config: ProjectorConfig,
  workspaceId: WorkspaceId,
  runId: RunId,
  batch: readonly EvidencePayload[],
): Promise<ProjectorResult> {
  if (batch.length === 0) {
    return { artifactsCreated: 0, evidenceProcessed: 0, skipped: 0 };
  }

  const { registry, semanticIndex, knowledgeGraph, embeddingPort, clock } = deps;
  const buildGraph = config.buildGraphNodes ?? true;
  const projectorVersion = config.projectorVersion;
  const shouldRedact = config.redactSecrets !== false; // default true

  // Load checkpoint for this workspace+run
  const checkpoint = await registry.loadCheckpoint(workspaceId, runId);
  const lastProcessed = checkpoint?.lastProcessedEvidenceId;

  let artifactsCreated = 0;
  let skipped = 0;
  let lastEvidenceId: EvidenceId | undefined;

  for (const evidence of batch) {
    // Skip already-processed entries (idempotency)
    if (lastProcessed !== undefined && evidence.evidenceId <= lastProcessed) {
      skipped++;
      continue;
    }

    const nowIso = clock.nowIso();
    const embeddingArtifactId = `emb:${workspaceId}:${evidence.evidenceId}`;

    // Redact secrets from evidence before sending to external systems.
    const safeText = shouldRedact ? redactEvidenceText(evidence.text) : evidence.text;
    const safeMetadata = shouldRedact ? redactMetadata(evidence.metadata) : evidence.metadata;

    // 1. Embed the (redacted) text
    const { vector, model } = await embeddingPort.embed({
      text: safeText,
      ...(config.embeddingModel !== undefined ? { model: config.embeddingModel } : {}),
    });

    // 2. Save embedding artifact metadata
    const embeddingArtifact = parseDerivedArtifactV1({
      schemaVersion: 1,
      artifactId: embeddingArtifactId,
      workspaceId,
      kind: 'embedding',
      provenance: { workspaceId, runId, projectorVersion, evidenceId: evidence.evidenceId },
      retentionPolicy: 'run-lifetime',
      createdAtIso: nowIso,
    });
    await registry.save(embeddingArtifact);

    // 3. Upsert into semantic index (redacted text + metadata)
    await semanticIndex.upsert({
      artifactId: embeddingArtifactId,
      workspaceId,
      runId,
      evidenceId: evidence.evidenceId,
      text: safeText,
      vector,
      metadata: { ...safeMetadata, embeddingModel: model },
    });
    artifactsCreated++;

    // 4. Optionally project a graph node for the evidence entry
    if (buildGraph) {
      const nodeArtifactId = `gnode:${workspaceId}:${evidence.evidenceId}`;
      const nodeArtifact = parseDerivedArtifactV1({
        schemaVersion: 1,
        artifactId: nodeArtifactId,
        workspaceId,
        kind: 'graph-node',
        provenance: { workspaceId, runId, projectorVersion, evidenceId: evidence.evidenceId },
        retentionPolicy: 'run-lifetime',
        createdAtIso: nowIso,
      });
      await registry.save(nodeArtifact);
      // Graph node properties use redacted metadata (secrets must not leave the boundary)
      await knowledgeGraph.upsertNode({
        nodeId: nodeArtifactId,
        workspaceId,
        kind: 'evidence-entry',
        label: evidence.evidenceId,
        properties: {
          runId,
          createdAtIso: evidence.createdAtIso,
          ...safeMetadata,
        },
      });
      artifactsCreated++;
    }

    lastEvidenceId = evidence.evidenceId;
  }

  // 5. Advance checkpoint if we processed anything
  if (lastEvidenceId !== undefined) {
    await registry.saveCheckpoint({
      workspaceId,
      runId,
      lastProcessedEvidenceId: lastEvidenceId,
      lastProcessedAtIso: clock.nowIso(),
      projectorVersion,
    });
  }

  return {
    artifactsCreated,
    evidenceProcessed: batch.length - skipped,
    skipped,
  };
}
