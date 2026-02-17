import type { RunId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';

export interface RunStore {
  getRunById(tenantId: TenantId, workspaceId: WorkspaceId, runId: RunId): Promise<RunV1 | null>;
  saveRun(tenantId: TenantId, run: RunV1): Promise<void>;
}
