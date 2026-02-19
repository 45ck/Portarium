import type { TenantId, WorkforceMemberId } from '../../domain/primitives/index.js';
import type { WorkforceMemberV1 } from '../../domain/workforce/index.js';

export interface WorkforceMemberStore {
  getWorkforceMemberById(
    tenantId: TenantId,
    workforceMemberId: WorkforceMemberId,
  ): Promise<WorkforceMemberV1 | null>;

  listWorkforceMembersByIds(
    tenantId: TenantId,
    workforceMemberIds: readonly WorkforceMemberId[],
  ): Promise<readonly WorkforceMemberV1[]>;
}
