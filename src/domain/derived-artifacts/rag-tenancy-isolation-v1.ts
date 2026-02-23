/**
 * RAG tenancy isolation model.
 *
 * Defines the isolation strategies for vector and graph retrieval backends,
 * workspace-scoped query validation, and cross-workspace data leakage
 * prevention rules.
 *
 * Bead: bead-vuz4
 * ADR: ADR-0107 (RAG Tenancy Isolation)
 */

import type { WorkspaceId } from '../primitives/index.js';

// ── Isolation strategies ────────────────────────────────────────────────────

/**
 * Vector DB isolation strategies:
 * - **collection-per-workspace**: Each workspace gets a dedicated collection/table.
 *   Strongest isolation, eliminates filter bypass risk. Higher operational cost.
 * - **shared-collection-filtered**: Shared collection with workspace_id filter
 *   on every query. Simpler to operate, but filter bypass = data leakage.
 */
const VECTOR_ISOLATION_STRATEGIES = [
  'collection-per-workspace',
  'shared-collection-filtered',
] as const;

export type VectorIsolationStrategy = (typeof VECTOR_ISOLATION_STRATEGIES)[number];

export function isVectorIsolationStrategy(value: string): value is VectorIsolationStrategy {
  return (VECTOR_ISOLATION_STRATEGIES as readonly string[]).includes(value);
}

/**
 * Graph DB isolation strategies:
 * - **database-per-workspace**: Each workspace gets a dedicated database/graph.
 *   Strongest isolation. Supported by Neo4j multi-database.
 * - **shared-graph-filtered**: Shared graph with workspace_id on all nodes/edges.
 *   Simpler, but traversal must never cross workspace boundaries.
 */
const GRAPH_ISOLATION_STRATEGIES = ['database-per-workspace', 'shared-graph-filtered'] as const;

export type GraphIsolationStrategy = (typeof GRAPH_ISOLATION_STRATEGIES)[number];

export function isGraphIsolationStrategy(value: string): value is GraphIsolationStrategy {
  return (GRAPH_ISOLATION_STRATEGIES as readonly string[]).includes(value);
}

// ── RAG tenancy policy ──────────────────────────────────────────────────────

export type RagTenancyPolicy = Readonly<{
  /** How vector data is isolated per workspace. */
  vectorIsolation: VectorIsolationStrategy;
  /** How graph data is isolated per workspace. */
  graphIsolation: GraphIsolationStrategy;
  /** Whether cross-workspace retrieval is ever permitted (e.g., for platform-wide search). */
  allowCrossWorkspaceRetrieval: boolean;
  /** Maximum number of results returned per query (defense-in-depth). */
  maxResultsPerQuery: number;
  /** Whether audit logging is required for every retrieval query. */
  requireRetrievalAuditLog: boolean;
}>;

export type RagPolicyValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * Validate a RAG tenancy policy for internal consistency.
 */
export function validateRagTenancyPolicy(policy: RagTenancyPolicy): RagPolicyValidationResult {
  if (policy.maxResultsPerQuery <= 0) {
    return {
      valid: false,
      reason: `maxResultsPerQuery must be positive, got ${policy.maxResultsPerQuery}.`,
    };
  }

  if (policy.maxResultsPerQuery > 1000) {
    return {
      valid: false,
      reason: `maxResultsPerQuery exceeds maximum of 1000, got ${policy.maxResultsPerQuery}.`,
    };
  }

  // Cross-workspace retrieval with shared-collection-filtered is high risk
  if (
    policy.allowCrossWorkspaceRetrieval &&
    policy.vectorIsolation === 'shared-collection-filtered'
  ) {
    return {
      valid: false,
      reason:
        'Cross-workspace retrieval is not permitted with shared-collection-filtered vector isolation. ' +
        'Use collection-per-workspace to enable cross-workspace search safely.',
    };
  }

  // If cross-workspace retrieval is allowed, audit logging must be required
  if (policy.allowCrossWorkspaceRetrieval && !policy.requireRetrievalAuditLog) {
    return {
      valid: false,
      reason: 'Cross-workspace retrieval requires audit logging to be enabled.',
    };
  }

  return { valid: true };
}

// ── Query scope validation ──────────────────────────────────────────────────

export type ScopedRetrievalQuery = Readonly<{
  /** The workspace making the query. */
  callerWorkspaceId: WorkspaceId;
  /** The workspace whose data is being queried. */
  targetWorkspaceId: WorkspaceId;
  /** Query text or vector. */
  queryText: string;
  /** Maximum results requested. */
  topK: number;
}>;

/**
 * Validate that a retrieval query respects workspace boundaries.
 */
export function validateRetrievalQueryScope(
  query: ScopedRetrievalQuery,
  policy: RagTenancyPolicy,
): RagPolicyValidationResult {
  // Query text must be non-empty
  if (!query.queryText.trim()) {
    return { valid: false, reason: 'queryText must be non-empty.' };
  }

  // topK must be positive and within policy limit
  if (query.topK <= 0) {
    return { valid: false, reason: `topK must be positive, got ${query.topK}.` };
  }

  if (query.topK > policy.maxResultsPerQuery) {
    return {
      valid: false,
      reason: `topK (${query.topK}) exceeds policy maximum of ${policy.maxResultsPerQuery}.`,
    };
  }

  // Cross-workspace check
  const isCrossWorkspace = String(query.callerWorkspaceId) !== String(query.targetWorkspaceId);
  if (isCrossWorkspace && !policy.allowCrossWorkspaceRetrieval) {
    return {
      valid: false,
      reason:
        `Cross-workspace retrieval denied: caller workspace '${String(query.callerWorkspaceId)}' ` +
        `cannot query target workspace '${String(query.targetWorkspaceId)}'.`,
    };
  }

  return { valid: true };
}

// ── Result provenance validation ────────────────────────────────────────────

export type RetrievalResultProvenance = Readonly<{
  /** Result's workspace ID from the data store. */
  resultWorkspaceId: WorkspaceId;
  /** The workspace that issued the query. */
  queryWorkspaceId: WorkspaceId;
}>;

/**
 * Post-query defense: validate that every result returned by the retrieval
 * backend belongs to the expected workspace. This catches filter bypass bugs
 * in the storage layer.
 */
export function validateResultProvenance(
  results: readonly RetrievalResultProvenance[],
  policy: RagTenancyPolicy,
): RagPolicyValidationResult {
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;

    const isCrossWorkspace = String(result.resultWorkspaceId) !== String(result.queryWorkspaceId);

    if (isCrossWorkspace && !policy.allowCrossWorkspaceRetrieval) {
      return {
        valid: false,
        reason:
          `Result at index ${i} belongs to workspace '${String(result.resultWorkspaceId)}' ` +
          `but query was scoped to workspace '${String(result.queryWorkspaceId)}'. ` +
          'This indicates a data leakage bug in the storage adapter.',
      };
    }
  }

  return { valid: true };
}

// ── Workspace data lifecycle ────────────────────────────────────────────────

export type WorkspaceDataLifecycleAction = 'provision' | 'deprovision' | 'export' | 'purge';

/**
 * Validate that a workspace data lifecycle action is safe to perform.
 */
export function validateWorkspaceDataAction(
  action: WorkspaceDataLifecycleAction,
  workspaceId: WorkspaceId,
): RagPolicyValidationResult {
  const wsStr = String(workspaceId);

  if (!wsStr.trim()) {
    return { valid: false, reason: 'workspaceId must be non-empty for data lifecycle actions.' };
  }

  // Purge and deprovision are destructive -- workspace ID must not be a glob/wildcard
  if ((action === 'purge' || action === 'deprovision') && (wsStr === '*' || wsStr === '%')) {
    return {
      valid: false,
      reason: `Wildcard workspaceId '${wsStr}' is not permitted for destructive action '${action}'.`,
    };
  }

  return { valid: true };
}
