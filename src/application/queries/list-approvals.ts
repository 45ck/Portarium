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

function ensureNonEmptyString(
  value: string | undefined,
  field: string,
): Result<void, ValidationFailed> {
  if (value?.trim() === '') {
    return err({ kind: 'ValidationFailed', message: `${field} must be a non-empty string.` });
  }
  return ok(undefined);
}

function validateInput(input: ListApprovalsInput): Result<void, ValidationFailed> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }
  if (input.cursor?.trim() === '') {
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
    const validString = ensureNonEmptyString(value, field);
    if (!validString.ok) {
      return validString;
    }
  }

  return ok(undefined);
}

function parseIds(
  input: ListApprovalsInput,
): Result<
  Readonly<{
    workspaceId: WorkspaceIdType;
    runId?: RunIdType;
    planId?: PlanIdType;
    workItemId?: WorkItemIdType;
    assigneeUserId?: UserIdType;
    requestedByUserId?: UserIdType;
  }>,
  ValidationFailed
> {
  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      ...(input.runId ? { runId: RunId(input.runId) } : {}),
      ...(input.planId ? { planId: PlanId(input.planId) } : {}),
      ...(input.workItemId ? { workItemId: WorkItemId(input.workItemId) } : {}),
      ...(input.assigneeUserId ? { assigneeUserId: UserId(input.assigneeUserId) } : {}),
      ...(input.requestedByUserId
        ? { requestedByUserId: UserId(input.requestedByUserId) }
        : {}),
    });
  } catch {
    return err({
      kind: 'ValidationFailed',
      message:
        'Invalid workspaceId/runId/planId/workItemId/assigneeUserId/requestedByUserId.',
    });
  }
}

function buildFilter(
  input: ListApprovalsInput,
  parsed: Readonly<{
    runId?: RunIdType;
    planId?: PlanIdType;
    workItemId?: WorkItemIdType;
    assigneeUserId?: UserIdType;
    requestedByUserId?: UserIdType;
  }>,
): ListApprovalsFilter {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(parsed.runId ? { runId: parsed.runId } : {}),
    ...(parsed.planId ? { planId: parsed.planId } : {}),
    ...(parsed.workItemId ? { workItemId: parsed.workItemId } : {}),
    ...(parsed.assigneeUserId ? { assigneeUserId: parsed.assigneeUserId } : {}),
    ...(parsed.requestedByUserId ? { requestedByUserId: parsed.requestedByUserId } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

function parseInput(
  input: ListApprovalsInput,
): Result<Readonly<{ workspaceId: WorkspaceIdType; filter: ListApprovalsFilter }>, ValidationFailed> {
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }

  const parsed = parseIds(input);
  if (!parsed.ok) {
    return parsed;
  }

  return ok({
    workspaceId: parsed.value.workspaceId,
    filter: buildFilter(input, parsed.value),
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
