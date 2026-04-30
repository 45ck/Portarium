import { type PolicyId, type TenantId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';
import type { Page, PaginationParams } from '../common/query.js';

export interface PolicyStore {
  listPolicies?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    pagination?: PaginationParams,
  ): Promise<Page<PolicyV1>>;
  getPolicyById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyId: PolicyId,
  ): Promise<PolicyV1 | null>;
  savePolicy(tenantId: TenantId, workspaceId: WorkspaceId, policy: PolicyV1): Promise<void>;
}
