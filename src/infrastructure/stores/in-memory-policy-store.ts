import type { PolicyId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { PolicyV1 } from '../../domain/policy/index.js';
import type { PolicyStore } from '../../application/ports/policy-store.js';

export class InMemoryPolicyStore implements PolicyStore {
  readonly #store = new Map<string, PolicyV1>();

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
