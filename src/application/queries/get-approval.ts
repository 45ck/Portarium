import {
  ApprovalId,
  type ApprovalId as ApprovalIdType,
  WorkspaceId,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalV1 } from '../../domain/approvals/index.js';
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
import type { ApprovalStore, AuthorizationPort } from '../ports/index.js';

export type GetApprovalInput = Readonly<{
  workspaceId: string;
  approvalId: string;
}>;

export type GetApprovalOutput = Readonly<ApprovalV1>;

export type GetApprovalError = Forbidden | ValidationFailed | NotFound;

export interface GetApprovalDeps {
  authorization: AuthorizationPort;
  approvalStore: ApprovalStore;
}

export async function getApproval(
  deps: GetApprovalDeps,
  ctx: AppContext,
  input: GetApprovalInput,
): Promise<Result<GetApprovalOutput, GetApprovalError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.approvalRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalRead,
      message: 'Caller is not permitted to read approvals.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.approvalId !== 'string' || input.approvalId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'approvalId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let approvalId: ApprovalIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    approvalId = ApprovalId(input.approvalId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or approvalId.' });
  }

  const approval = await deps.approvalStore.getApprovalById(ctx.tenantId, workspaceId, approvalId);
  if (approval === null) {
    return err({
      kind: 'NotFound',
      resource: 'Approval',
      message: `Approval ${input.approvalId} not found.`,
    });
  }

  return ok(approval);
}

