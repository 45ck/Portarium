/**
 * bead-0780: Security utilities for retrieval and graph HTTP handlers.
 *
 * Enforces three boundaries:
 *   1. Input limits  — caps query length, topK, and maxDepth to prevent DoS.
 *   2. Redaction     — strips secrets from text and metadata in responses via
 *                      the application-layer DerivedArtifactRedactor.
 *   3. Tenant isolation — defense-in-depth filter that discards any result
 *                      whose provenance.workspaceId does not match the
 *                      authenticated workspace (belt-and-suspenders over the
 *                      port-level workspace scoping).
 *
 * All functions are pure and side-effect-free.
 */

import type { WorkspaceId } from '../../domain/primitives/index.js';
import {
  redactEvidenceText,
  redactMetadata,
} from '../../application/services/derived-artifact-redactor.js';
import type { RetrievalHit } from '../../application/services/retrieval-query-router.js';
import type { GraphNodeV1, GraphEdgeV1 } from '../../domain/derived-artifacts/retrieval-ports.js';

// ---------------------------------------------------------------------------
// Input limits
// ---------------------------------------------------------------------------

export const RETRIEVAL_LIMITS = {
  /** Maximum character length accepted for a semantic search query string. */
  maxQueryLength: 2048,
  /** Maximum number of nearest-neighbour hits that can be requested per search. */
  maxTopK: 100,
  /** Maximum graph traversal depth allowed per request. */
  maxDepth: 10,
} as const;

/**
 * Returns an error message if the query string exceeds `RETRIEVAL_LIMITS.maxQueryLength`,
 * or `null` if the query is within bounds.
 */
export function validateQueryLength(query: string): string | null {
  if (query.length > RETRIEVAL_LIMITS.maxQueryLength) {
    return `semantic.query must not exceed ${RETRIEVAL_LIMITS.maxQueryLength} characters.`;
  }
  return null;
}

/**
 * Returns an error message if topK exceeds `RETRIEVAL_LIMITS.maxTopK`, or `null` if valid.
 */
export function validateTopK(topK: number): string | null {
  if (topK > RETRIEVAL_LIMITS.maxTopK) {
    return `topK must not exceed ${RETRIEVAL_LIMITS.maxTopK}.`;
  }
  return null;
}

/**
 * Returns an error message if maxDepth exceeds `RETRIEVAL_LIMITS.maxDepth`, or `null` if valid.
 */
export function validateMaxDepth(maxDepth: number): string | null {
  if (maxDepth > RETRIEVAL_LIMITS.maxDepth) {
    return `maxDepth must not exceed ${RETRIEVAL_LIMITS.maxDepth}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Response redaction
// ---------------------------------------------------------------------------

/**
 * Returns a new array of hits with secrets stripped from each hit's `text`
 * and `metadata` fields.  Safe to call on hits that have no secrets — the
 * redactor is idempotent.
 */
export function redactHits(hits: readonly RetrievalHit[]): readonly RetrievalHit[] {
  return hits.map((hit) => ({
    ...hit,
    ...(hit.text !== undefined ? { text: redactEvidenceText(hit.text) } : {}),
    metadata: redactMetadata(hit.metadata),
  }));
}

/**
 * Returns a new array of graph nodes with secrets stripped from each node's
 * `properties` record.
 */
export function redactGraphNodes(nodes: readonly GraphNodeV1[]): readonly GraphNodeV1[] {
  return nodes.map((node) => ({
    ...node,
    properties: redactMetadata(node.properties),
  }));
}

/**
 * Returns a new array of graph edges with secrets stripped from each edge's
 * `properties` record (when present).
 */
export function redactGraphEdges(edges: readonly GraphEdgeV1[]): readonly GraphEdgeV1[] {
  return edges.map((edge) => ({
    ...edge,
    ...(edge.properties !== undefined ? { properties: redactMetadata(edge.properties) } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Tenant isolation (defense-in-depth)
// ---------------------------------------------------------------------------

/**
 * Discards any retrieval hit whose `provenance.workspaceId` does not equal
 * the authenticated workspace.  This is a second line of defence on top of
 * the workspace-scoped query parameters passed to the underlying ports.
 */
export function filterHitsToWorkspace(
  hits: readonly RetrievalHit[],
  wsId: WorkspaceId,
): readonly RetrievalHit[] {
  return hits.filter((h) => h.provenance.workspaceId === wsId);
}

/**
 * Discards any graph node whose `workspaceId` does not equal the
 * authenticated workspace.
 */
export function filterNodesToWorkspace(
  nodes: readonly GraphNodeV1[],
  wsId: WorkspaceId,
): readonly GraphNodeV1[] {
  return nodes.filter((n) => n.workspaceId === wsId);
}

/**
 * Discards any graph edge whose `workspaceId` does not equal the
 * authenticated workspace.
 */
export function filterEdgesToWorkspace(
  edges: readonly GraphEdgeV1[],
  wsId: WorkspaceId,
): readonly GraphEdgeV1[] {
  return edges.filter((e) => e.workspaceId === wsId);
}
