import { type ApprovalId, type TenantId, type WorkspaceId } from '../../domain/primitives/index.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';

export interface ApprovalStore {
  getApprovalById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    approvalId: ApprovalId,
  ): Promise<ApprovalV1 | null>;
  saveApproval(tenantId: TenantId, approval: ApprovalV1): Promise<void>;
}
