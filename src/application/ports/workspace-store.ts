import type { TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/index.js';

export type ListWorkspacesFilter = Readonly<{
  nameQuery?: string;
  limit?: number;
  cursor?: string;
}>;

export type WorkspaceListPage = Readonly<{
  items: readonly WorkspaceV1[];
  nextCursor?: string;
}>;

export interface WorkspaceStore {
  getWorkspaceById(tenantId: TenantId, workspaceId: WorkspaceId): Promise<WorkspaceV1 | null>;
  getWorkspaceByName(tenantId: TenantId, workspaceName: string): Promise<WorkspaceV1 | null>;
  saveWorkspace(workspace: WorkspaceV1): Promise<void>;
}

export interface WorkspaceQueryStore {
  listWorkspaces(tenantId: TenantId, filter: ListWorkspacesFilter): Promise<WorkspaceListPage>;
}
