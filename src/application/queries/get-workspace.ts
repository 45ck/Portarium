import { type WorkspaceId, WorkspaceId as brandWorkspaceId } from '../../domain/primitives/index.js';
import { type AppContext, APP_ACTIONS, type Forbidden, type NotFound, type ValidationFailed } from '../common/index.js';
import { err, ok, type Result } from '../common/result.js';
import type { AuthorizationPort, WorkspaceStore } from '../ports/index.js';
import type { WorkspaceV1 } from '../../domain/workspaces/index.js';

export type GetWorkspaceInput = Readonly<{
  workspaceId: string;
}>;

export type GetWorkspaceOutput = Readonly<WorkspaceV1>;

export type GetWorkspaceError = Forbidden | NotFound | ValidationFailed;

export interface GetWorkspaceDeps {
  authorization: AuthorizationPort;
  workspaceStore: WorkspaceStore;
}

export async function getWorkspace(
  deps: GetWorkspaceDeps,
  ctx: AppContext,
  input: GetWorkspaceInput,
): Promise<Result<GetWorkspaceOutput, GetWorkspaceError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.workspaceRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.workspaceRead,
      message: 'Caller is not permitted to read workspaces.',
    });
  }

  let workspaceId: WorkspaceId;
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }

  try {
    workspaceId = brandWorkspaceId(input.workspaceId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }

  const workspace = await deps.workspaceStore.getWorkspaceById(ctx.tenantId, workspaceId);
  if (workspace === null) {
    return err({
      kind: 'NotFound',
      resource: 'Workspace',
      message: `Workspace ${input.workspaceId} not found.`,
    });
  }

  return ok(workspace);
}
