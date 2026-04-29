import { WorkspaceId, type WorkspaceId as WorkspaceIdType } from '../../domain/primitives/index.js';
import {
  APP_ACTIONS,
  err,
  ok,
  type AppContext,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type { AuthorizationPort, BeadDiffHunk, BeadDiffStore } from '../ports/index.js';

export type GetBeadDiffInput = Readonly<{
  workspaceId: string;
  beadId: string;
}>;

export type GetBeadDiffError = Forbidden | ValidationFailed | NotFound;

export interface GetBeadDiffDeps {
  authorization: AuthorizationPort;
  beadDiffStore: BeadDiffStore;
}

export async function getBeadDiff(
  deps: GetBeadDiffDeps,
  ctx: AppContext,
  input: GetBeadDiffInput,
): Promise<Result<readonly BeadDiffHunk[], GetBeadDiffError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workItemRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workItemRead,
      message: 'Caller is not permitted to read bead diffs.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.beadId !== 'string' || input.beadId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'beadId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId.' });
  }

  const hunks = await deps.beadDiffStore.getBeadDiff(ctx.tenantId, workspaceId, input.beadId);
  if (hunks === null) {
    return err({
      kind: 'NotFound',
      resource: 'BeadDiff',
      message: `Diff for bead ${input.beadId} not found.`,
    });
  }
  return ok(hunks);
}
