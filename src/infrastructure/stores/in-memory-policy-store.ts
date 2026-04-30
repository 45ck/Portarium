import type { PolicyId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';
import type { PolicyStore } from '../../application/ports/policy-store.js';
import { clampLimit, type Page, type PaginationParams } from '../../application/common/query.js';

export class InMemoryPolicyStore implements PolicyStore {
  readonly #store = new Map<string, PolicyV1>();

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

  #key(tenantId: TenantId, workspaceId: WorkspaceId, policyId: PolicyId): string {
    return `${String(tenantId)}::${String(workspaceId)}::${String(policyId)}`;
  }
}
