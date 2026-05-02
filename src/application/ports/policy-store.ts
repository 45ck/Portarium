import {
  type PolicyChangeId,
  type PolicyId,
  type TenantId,
  type WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  PolicyChangeAuditEntryV1,
  PolicyChangeRequestV1,
  PolicyV1,
} from '../../domain/policy/index.js';
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
  listPolicyChanges?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyId: PolicyId,
    pagination?: PaginationParams,
  ): Promise<Page<PolicyChangeRequestV1>>;
  getPolicyChangeById?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyChangeId: PolicyChangeId,
  ): Promise<PolicyChangeRequestV1 | null>;
  savePolicyChange?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    change: PolicyChangeRequestV1,
  ): Promise<void>;
  appendPolicyChangeAuditEntry?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    entry: PolicyChangeAuditEntryV1,
  ): Promise<void>;
  listPolicyChangeAuditEntries?(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyChangeId: PolicyChangeId,
  ): Promise<readonly PolicyChangeAuditEntryV1[]>;
}
