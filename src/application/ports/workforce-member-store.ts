import type { TenantId, WorkforceMemberId, WorkspaceId } from '../../domain/primitives/index.js';
import type {
  WorkforceAvailabilityStatus,
  WorkforceCapability,
  WorkforceMemberV1,
} from '../../domain/workforce/index.js';

export type ListWorkforceMembersFilter = Readonly<{
  workspaceId: WorkspaceId | string;
  capability?: WorkforceCapability | string;
  queueId?: string;
  availability?: WorkforceAvailabilityStatus;
  limit?: number;
  cursor?: string;
}>;

export type WorkforceMemberListPage = Readonly<{
  items: readonly WorkforceMemberV1[];
  nextCursor?: string;
}>;

export interface WorkforceMemberStore {
  getWorkforceMemberById(
    tenantId: TenantId,
    workforceMemberId: WorkforceMemberId,
    workspaceId?: WorkspaceId | string,
  ): Promise<WorkforceMemberV1 | null>;

  listWorkforceMembersByIds(
    tenantId: TenantId,
    workforceMemberIds: readonly WorkforceMemberId[],
    workspaceId?: WorkspaceId | string,
  ): Promise<readonly WorkforceMemberV1[]>;

  listWorkforceMembers?(
    tenantId: TenantId,
    filter: ListWorkforceMembersFilter,
  ): Promise<WorkforceMemberListPage>;

  saveWorkforceMember?(
    tenantId: TenantId,
    member: WorkforceMemberV1,
    workspaceId?: WorkspaceId | string,
  ): Promise<void>;
}
