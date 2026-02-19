import type {
  ApprovalId,
  EvidenceId,
  RunId,
  TenantId,
  UserId,
  WorkflowId,
  WorkItemId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { WorkItemStatus, WorkItemV1 } from '../../domain/work-items/index.js';

export type ListWorkItemsFilter = Readonly<{
  status?: WorkItemStatus;
  ownerUserId?: UserId;
  runId?: RunId;
  workflowId?: WorkflowId;
  approvalId?: ApprovalId;
  evidenceId?: EvidenceId;
  limit?: number;
  cursor?: string;
}>;

export type WorkItemListPage = Readonly<{
  items: readonly WorkItemV1[];
  nextCursor?: string;
}>;

export interface WorkItemStore {
  getWorkItemById(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    workItemId: WorkItemId,
  ): Promise<WorkItemV1 | null>;

  listWorkItems(
    tenantId: TenantId,
    workspaceId: WorkspaceId,
    filter: ListWorkItemsFilter,
  ): Promise<WorkItemListPage>;

  saveWorkItem(tenantId: TenantId, workItem: WorkItemV1): Promise<void>;
}
