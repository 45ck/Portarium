import type { RunId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { RunStatus, RunV1 } from '../../domain/runs/index.js';

export type ListRunsFilter = Readonly<{
  status?: RunStatus;
  workflowId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
  limit?: number;
  cursor?: string;
}>;

export type RunListPage = Readonly<{
  items: readonly RunV1[];
  nextCursor?: string;
}>;

export interface RunStore {
  getRunById(tenantId: TenantId, workspaceId: WorkspaceId, runId: RunId): Promise<RunV1 | null>;
  saveRun(tenantId: TenantId, run: RunV1): Promise<void>;
}

export interface RunQueryStore {
  listRuns(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    filter: ListRunsFilter,
  ): Promise<RunListPage>;
}
