import type { RunId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { RunStatus, RunV1 } from '../../domain/runs/index.js';
import type { Page, PaginationParams, SortClause } from '../common/query.js';

// ---------------------------------------------------------------------------
// Field-level filter (no pagination/sort — those are in ListRunsQuery)
// ---------------------------------------------------------------------------

export type RunFieldFilter = Readonly<{
  status?: RunStatus;
  workflowId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
}>;

// ---------------------------------------------------------------------------
// Composite query object passed to the store
// ---------------------------------------------------------------------------

export type ListRunsQuery = Readonly<{
  filter: RunFieldFilter;
  pagination: PaginationParams;
  sort?: SortClause;
  search?: string;
}>;

// ---------------------------------------------------------------------------
// Sortable fields registry
// ---------------------------------------------------------------------------

export const RUN_SORTABLE_FIELDS = ['runId', 'status', 'createdAtIso', 'startedAtIso'] as const;

export type RunSortField = (typeof RUN_SORTABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// Legacy alias — consumers migrating from old filter shape
// ---------------------------------------------------------------------------

/** @deprecated Use `ListRunsQuery` with `RunFieldFilter` + `PaginationParams` instead. */
export type ListRunsFilter = Readonly<{
  status?: RunStatus;
  workflowId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
  limit?: number;
  cursor?: string;
}>;

export type RunListPage = Page<RunV1>;

// ---------------------------------------------------------------------------
// Store interfaces
// ---------------------------------------------------------------------------

export interface RunStore {
  getRunById(tenantId: TenantId, workspaceId: WorkspaceId, runId: RunId): Promise<RunV1 | null>;
  saveRun(tenantId: TenantId, run: RunV1): Promise<void>;
}

export interface RunQueryStore {
  listRuns(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    query: ListRunsQuery,
  ): Promise<Page<RunV1>>;
}
