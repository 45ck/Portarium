/**
 * Port that projection workers implement to update denormalized read tables.
 * Each method is idempotent — safe to replay the same event multiple times.
 * Bead: bead-0315
 */

export interface RunProjectionEvent {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly workflowId: string;
  readonly status: string;
  readonly initiatedByUserId?: string;
  readonly createdAtIso: string;
  readonly startedAtIso?: string;
  readonly endedAtIso?: string;
  readonly eventSeq: number; // monotonically increasing; use for de-dup
}

export interface WorkspaceProjectionEvent {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly status: string;
  readonly createdAtIso: string;
  readonly eventSeq: number;
}

export interface ReadModelProjector {
  /** Upsert a run projection row; idempotent via eventSeq check. */
  upsertRun(event: RunProjectionEvent): Promise<void>;
  /** Upsert a workspace summary row; idempotent via eventSeq check. */
  upsertWorkspace(event: WorkspaceProjectionEvent): Promise<void>;
}
