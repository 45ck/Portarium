import {
  PlanId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
  type PlanId as PlanIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalStatus } from '../../domain/approvals/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  type Forbidden,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type {
  ApprovalListPage,
  ApprovalQueryStore,
  AuthorizationPort,
  ListApprovalsFilter,
} from '../ports/index.js';

const APPROVAL_STATUSES = ['Pending', 'Approved', 'Denied', 'RequestChanges'] as const;

export type ListApprovalsInput = Readonly<{
  workspaceId: string;
  status?: ApprovalStatus;
  runId?: string;
  planId?: string;
  workItemId?: string;
  assigneeUserId?: string;
  requestedByUserId?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListApprovalsOutput = Readonly<ApprovalListPage>;

export type ListApprovalsError = Forbidden | ValidationFailed;

export interface ListApprovalsDeps {
  authorization: AuthorizationPort;
  approvalStore: ApprovalQueryStore;
}

function parseInput(
  input: ListApprovalsInput,
): Result<Readonly<{ workspaceId: WorkspaceIdType; filter: ListApprovalsFilter }>, ValidationFailed> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }
  if (input.cursor !== undefined && input.cursor.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'cursor must be a non-empty string.' });
  }
  if (input.status !== undefined && !APPROVAL_STATUSES.includes(input.status)) {
    return err({ kind: 'ValidationFailed', message: 'status is invalid.' });
  }

  for (const [field, value] of [
    ['runId', input.runId],
    ['planId', input.planId],
    ['workItemId', input.workItemId],
    ['assigneeUserId', input.assigneeUserId],
    ['requestedByUserId', input.requestedByUserId],
  ] as const) {
    if (value !== undefined && value.trim() === '') {
      return err({ kind: 'ValidationFailed', message: `${field} must be a non-empty string.` });
    }
  }

  let workspaceId: WorkspaceIdType;
  let runId: RunIdType | undefined;
  let planId: PlanIdType | undefined;
  let workItemId: WorkItemIdType | undefined;
  let assigneeUserId: UserIdType | undefined;
  let requestedByUserId: UserIdType | undefined;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    runId = input.runId ? RunId(input.runId) : undefined;
    planId = input.planId ? PlanId(input.planId) : undefined;
    workItemId = input.workItemId ? WorkItemId(input.workItemId) : undefined;
    assigneeUserId = input.assigneeUserId ? UserId(input.assigneeUserId) : undefined;
    requestedByUserId = input.requestedByUserId ? UserId(input.requestedByUserId) : undefined;
  } catch {
    return err({
      kind: 'ValidationFailed',
      message:
        'Invalid workspaceId/runId/planId/workItemId/assigneeUserId/requestedByUserId.',
    });
  }

  return ok({
    workspaceId,
    filter: {
      ...(input.status ? { status: input.status } : {}),
      ...(runId ? { runId } : {}),
      ...(planId ? { planId } : {}),
      ...(workItemId ? { workItemId } : {}),
      ...(assigneeUserId ? { assigneeUserId } : {}),
      ...(requestedByUserId ? { requestedByUserId } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
  });
}

export async function listApprovals(
  deps: ListApprovalsDeps,
  ctx: AppContext,
  input: ListApprovalsInput,
): Promise<Result<ListApprovalsOutput, ListApprovalsError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.approvalRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalRead,
      message: 'Caller is not permitted to list approvals.',
    });
  }

  const parsed = parseInput(input);
  if (!parsed.ok) {
    return parsed;
  }

  const page = await deps.approvalStore.listApprovals(
    ctx.tenantId,
    parsed.value.workspaceId,
    parsed.value.filter,
  );
  return ok(page);
}

