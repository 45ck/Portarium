import {
  WorkItemId,
  WorkspaceId,
  type WorkItemId as WorkItemIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { WorkItemV1 } from '../../domain/work-items/index.js';
import {
  type AppContext,
  type Forbidden,
  type NotFound,
  APP_ACTIONS,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type { AuthorizationPort, WorkItemStore } from '../ports/index.js';

export type GetWorkItemInput = Readonly<{
  workspaceId: string;
  workItemId: string;
}>;

export type GetWorkItemOutput = Readonly<WorkItemV1>;

export type GetWorkItemError = Forbidden | ValidationFailed | NotFound;

export interface GetWorkItemDeps {
  authorization: AuthorizationPort;
  workItemStore: WorkItemStore;
}

export async function getWorkItem(
  deps: GetWorkItemDeps,
  ctx: AppContext,
  input: GetWorkItemInput,
): Promise<Result<GetWorkItemOutput, GetWorkItemError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workItemRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workItemRead,
      message: 'Caller is not permitted to read work items.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.workItemId !== 'string' || input.workItemId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workItemId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let workItemId: WorkItemIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    workItemId = WorkItemId(input.workItemId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or workItemId.' });
  }

  const workItem = await deps.workItemStore.getWorkItemById(ctx.tenantId, workspaceId, workItemId);
  if (workItem === null) {
    return err({
      kind: 'NotFound',
      resource: 'WorkItem',
      message: `WorkItem ${input.workItemId} not found.`,
    });
  }

  return ok(workItem);
}
