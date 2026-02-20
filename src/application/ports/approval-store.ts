import { type ApprovalId, type TenantId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { ApprovalStatus, ApprovalV1 } from '../../domain/approvals/index.js';

export type ListApprovalsFilter = Readonly<{
  status?: ApprovalStatus;
  runId?: string;
  planId?: string;
  workItemId?: string;
  assigneeUserId?: string;
  requestedByUserId?: string;
  limit?: number;
  cursor?: string;
}>;

export type ApprovalListPage = Readonly<{
  items: readonly ApprovalV1[];
  nextCursor?: string;
}>;

export interface ApprovalStore {
  getApprovalById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    approvalId: ApprovalId,
  ): Promise<ApprovalV1 | null>;
  saveApproval(tenantId: TenantId, approval: ApprovalV1): Promise<void>;
}

export interface ApprovalQueryStore {
  listApprovals(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    filter: ListApprovalsFilter,
  ): Promise<ApprovalListPage>;
}
