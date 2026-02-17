import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/index.js';

export interface WorkspaceStore {
  getWorkspaceById(tenantId: TenantId, workspaceId: WorkspaceId): Promise<WorkspaceV1 | null>;
  saveWorkspace(workspace: WorkspaceV1): Promise<void>;
}
