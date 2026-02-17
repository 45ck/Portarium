import {
  type RunId as RunIdType,
  RunId,
  WorkspaceId,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { RunV1 } from '../../domain/runs/index.js';
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
import type { AuthorizationPort, RunStore } from '../ports/index.js';

export type GetRunInput = Readonly<{
  workspaceId: string;
  runId: string;
}>;

export type GetRunOutput = Readonly<RunV1>;

export type GetRunError = Forbidden | ValidationFailed | NotFound;

export interface GetRunDeps {
  authorization: AuthorizationPort;
  runStore: RunStore;
}

export async function getRun(
  deps: GetRunDeps,
  ctx: AppContext,
  input: GetRunInput,
): Promise<Result<GetRunOutput, GetRunError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.runRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runRead,
      message: 'Caller is not permitted to read runs.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'runId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let runId: RunIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    runId = RunId(input.runId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or runId.' });
  }

  const run = await deps.runStore.getRunById(ctx.tenantId, workspaceId, runId);
  if (run === null) {
    return err({
      kind: 'NotFound',
      resource: 'Run',
      message: `Run ${input.runId} not found.`,
    });
  }

  return ok(run);
}
