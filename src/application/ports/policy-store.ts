import { type PolicyId, type TenantId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';

export interface PolicyStore {
  getPolicyById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyId: PolicyId,
  ): Promise<PolicyV1 | null>;
}
