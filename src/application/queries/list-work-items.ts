import {
  ApprovalId,
  EvidenceId,
  RunId,
  UserId,
  WorkflowId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { WorkItemStatus } from '../../domain/work-items/index.js';
import {
  type AppContext,
  type Forbidden,
  APP_ACTIONS,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type { AuthorizationPort, ListWorkItemsFilter, WorkItemStore } from '../ports/index.js';

export type ListWorkItemsInput = Readonly<{
  workspaceId: string;
  status?: WorkItemStatus;
  ownerUserId?: string;
  runId?: string;
  workflowId?: string;
  approvalId?: string;
  evidenceId?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListWorkItemsOutput = Awaited<ReturnType<WorkItemStore['listWorkItems']>>;

export type ListWorkItemsError = Forbidden | ValidationFailed;

export interface ListWorkItemsDeps {
  authorization: AuthorizationPort;
  workItemStore: WorkItemStore;
}

const WORK_ITEM_STATUSES = ['Open', 'InProgress', 'Blocked', 'Resolved', 'Closed'] as const;

export async function listWorkItems(
  deps: ListWorkItemsDeps,
  ctx: AppContext,
  input: ListWorkItemsInput,
): Promise<Result<ListWorkItemsOutput, ListWorkItemsError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workItemRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workItemRead,
      message: 'Caller is not permitted to list work items.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }

  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }

  if (input.status !== undefined && !WORK_ITEM_STATUSES.includes(input.status)) {
    return err({ kind: 'ValidationFailed', message: 'status is invalid.' });
  }

  for (const [field, value] of [
    ['ownerUserId', input.ownerUserId],
    ['runId', input.runId],
    ['workflowId', input.workflowId],
    ['approvalId', input.approvalId],
    ['evidenceId', input.evidenceId],
  ] as const) {
    if (value?.trim() === '') {
      return err({ kind: 'ValidationFailed', message: `${field} must be a non-empty string.` });
    }
  }

  try {
    const workspaceId = WorkspaceId(input.workspaceId);
    const filter: ListWorkItemsFilter = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.ownerUserId ? { ownerUserId: UserId(input.ownerUserId) } : {}),
      ...(input.runId ? { runId: RunId(input.runId) } : {}),
      ...(input.workflowId ? { workflowId: WorkflowId(input.workflowId) } : {}),
      ...(input.approvalId ? { approvalId: ApprovalId(input.approvalId) } : {}),
      ...(input.evidenceId ? { evidenceId: EvidenceId(input.evidenceId) } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    };
    const page = await deps.workItemStore.listWorkItems(ctx.tenantId, workspaceId, filter);
    return ok(page);
  } catch {
    return err({
      kind: 'ValidationFailed',
      message:
        'Invalid query filter values. ownerUserId/runId/workflowId/approvalId/evidenceId must be valid identifiers.',
    });
  }
}
