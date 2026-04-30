import type { Page, PaginationParams } from '../common/query.js';
import type { WorkspaceUserV1 } from '../../domain/users/index.js';
import type { TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';

export interface WorkspaceUserStore {
  listWorkspaceUsers(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    pagination?: PaginationParams,
  ): Promise<Page<WorkspaceUserV1>>;

  getWorkspaceUserById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    userId: UserId,
  ): Promise<WorkspaceUserV1 | null>;

  saveWorkspaceUser(tenantId: TenantId, user: WorkspaceUserV1): Promise<void>;

  removeWorkspaceUser(tenantId: TenantId, workspaceId: WorkspaceId, userId: UserId): Promise<void>;
}
