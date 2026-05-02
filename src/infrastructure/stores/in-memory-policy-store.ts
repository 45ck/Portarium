import type {
  PolicyChangeId,
  PolicyId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type {
  PolicyChangeAuditEntryV1,
  PolicyChangeRequestV1,
  PolicyV1,
} from '../../domain/policy/index.js';
import type { PolicyStore } from '../../application/ports/policy-store.js';
import { clampLimit, type Page, type PaginationParams } from '../../application/common/query.js';

export class InMemoryPolicyStore implements PolicyStore {
  readonly #store = new Map<string, PolicyV1>();
  readonly #changes = new Map<string, PolicyChangeRequestV1>();
  readonly #audit = new Map<string, PolicyChangeAuditEntryV1[]>();

  async listPolicies(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    pagination: PaginationParams = {},
  ): Promise<Page<PolicyV1>> {
    const prefix = `${String(tenantId)}::${String(workspaceId)}::`;
    const limit = clampLimit(pagination.limit);
    const rows = [...this.#store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, policy]) => policy)
      .filter((policy) => (pagination.cursor ? String(policy.policyId) > pagination.cursor : true))
      .sort((left, right) => String(left.policyId).localeCompare(String(right.policyId)));

    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      items,
      ...(hasMore && items.length > 0
        ? { nextCursor: String(items[items.length - 1]!.policyId) }
        : {}),
    };
  }

  async getPolicyById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyId: PolicyId,
  ): Promise<PolicyV1 | null> {
    return this.#store.get(this.#key(tenantId, workspaceId, policyId)) ?? null;
  }

  async savePolicy(tenantId: TenantId, workspaceId: WorkspaceId, policy: PolicyV1): Promise<void> {
    this.#store.set(this.#key(tenantId, workspaceId, policy.policyId), policy);
  }

  async listPolicyChanges(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyId: PolicyId,
    pagination: PaginationParams = {},
  ): Promise<Page<PolicyChangeRequestV1>> {
    const prefix = `${String(tenantId)}::${String(workspaceId)}::`;
    const limit = clampLimit(pagination.limit);
    const rows = [...this.#changes.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, change]) => change)
      .filter((change) => change.policyId === policyId)
      .filter((change) =>
        pagination.cursor ? String(change.policyChangeId) > pagination.cursor : true,
      )
      .sort((left, right) =>
        String(left.policyChangeId).localeCompare(String(right.policyChangeId)),
      );

    const items = rows.slice(0, limit);
    const hasMore = rows.length > limit;
    return {
      items,
      ...(hasMore && items.length > 0
        ? { nextCursor: String(items[items.length - 1]!.policyChangeId) }
        : {}),
    };
  }

  async getPolicyChangeById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyChangeId: PolicyChangeId,
  ): Promise<PolicyChangeRequestV1 | null> {
    return this.#changes.get(this.#changeKey(tenantId, workspaceId, policyChangeId)) ?? null;
  }

  async savePolicyChange(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    change: PolicyChangeRequestV1,
  ): Promise<void> {
    this.#changes.set(this.#changeKey(tenantId, workspaceId, change.policyChangeId), change);
  }

  async appendPolicyChangeAuditEntry(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    entry: PolicyChangeAuditEntryV1,
  ): Promise<void> {
    const key = this.#auditKey(tenantId, workspaceId, entry.policyChangeId);
    const entries = this.#audit.get(key) ?? [];
    this.#audit.set(key, [...entries, entry]);
  }

  async listPolicyChangeAuditEntries(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    policyChangeId: PolicyChangeId,
  ): Promise<readonly PolicyChangeAuditEntryV1[]> {
    return this.#audit.get(this.#auditKey(tenantId, workspaceId, policyChangeId)) ?? [];
  }

  #key(tenantId: TenantId, workspaceId: WorkspaceId, policyId: PolicyId): string {
    return `${String(tenantId)}::${String(workspaceId)}::${String(policyId)}`;
  }

  #changeKey(tenantId: TenantId, workspaceId: WorkspaceId, policyChangeId: PolicyChangeId): string {
    return `${String(tenantId)}::${String(workspaceId)}::${String(policyChangeId)}`;
  }

  #auditKey(tenantId: TenantId, workspaceId: WorkspaceId, policyChangeId: PolicyChangeId): string {
    return this.#changeKey(tenantId, workspaceId, policyChangeId);
  }
}
