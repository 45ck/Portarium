import type { ApprovalId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';
import type {
  ApprovalStore,
  ApprovalQueryStore,
  ApprovalListPage,
  ListApprovalsFilter,
} from '../../application/ports/approval-store.js';
import { pageByCursor } from '../postgresql/postgres-cursor-page.js';

export class InMemoryApprovalStore implements ApprovalStore, ApprovalQueryStore {
  readonly #store = new Map<string, ApprovalV1>();

  public async getApprovalById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    approvalId: ApprovalId,
  ): Promise<ApprovalV1 | null> {
    const approval = this.#store.get(this.#key(tenantId, approvalId)) ?? null;
    if (approval && String(approval.workspaceId) !== String(workspaceId)) {
      return null;
    }
    return approval;
  }

  public async saveApproval(tenantId: TenantId, approval: ApprovalV1): Promise<void> {
    this.#store.set(this.#key(tenantId, approval.approvalId), approval);
  }

  public async listApprovals(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    filter: ListApprovalsFilter,
  ): Promise<ApprovalListPage> {
    const items = [...this.#store.values()]
      .filter((a) => this.#matchesTenant(tenantId, a) && this.#matchesWorkspace(workspaceId, a))
      .filter((a) => matchFilter(a, filter))
      .sort((a, b) => String(a.approvalId).localeCompare(String(b.approvalId)));

    return pageByCursor(items, (a) => String(a.approvalId), filter.limit, filter.cursor);
  }

  #key(tenantId: TenantId, approvalId: ApprovalId): string {
    return `${String(tenantId)}:${String(approvalId)}`;
  }

  #matchesTenant(tenantId: TenantId, approval: ApprovalV1): boolean {
    // Approvals are keyed by tenant — check the key prefix matches
    const key = this.#key(tenantId, approval.approvalId);
    return this.#store.get(key) === approval;
  }

  #matchesWorkspace(workspaceId: WorkspaceId, approval: ApprovalV1): boolean {
    return String(approval.workspaceId) === String(workspaceId);
  }
}

function matchFilter(approval: ApprovalV1, filter: ListApprovalsFilter): boolean {
  if (filter.status && approval.status !== filter.status) return false;

  const checks: readonly (readonly [string | undefined, string | undefined])[] = [
    [filter.runId, String(approval.runId)],
    [filter.planId, String(approval.planId)],
    [filter.workItemId, approval.workItemId ? String(approval.workItemId) : undefined],
    [filter.assigneeUserId, approval.assigneeUserId ? String(approval.assigneeUserId) : undefined],
    [filter.requestedByUserId, String(approval.requestedByUserId)],
  ];

  return checks.every(([expected, actual]) => expected === undefined || actual === expected);
}
