import type { WorkspaceUserRole } from '../../../domain/primitives/index.js';
import type { AppAction } from '../../common/actions.js';
import type { WorkspaceActor } from '../workspace-actor.js';

export class WorkspaceAuthorizationError extends Error {
  public override readonly name = 'WorkspaceAuthorizationError';

  public constructor(
    message: string,
    public readonly action: AppAction,
    public readonly requiredRoles: readonly WorkspaceUserRole[],
    public readonly actorRoles: readonly WorkspaceUserRole[],
  ) {
    super(message);
  }
}

const ACTION_MATRIX: Readonly<Record<AppAction, readonly WorkspaceUserRole[]>> = {
  'workspace:register': ['admin'],
  'workspace:read': ['admin', 'operator', 'approver', 'auditor'],
  'run:read': ['admin', 'operator', 'approver', 'auditor'],
  'work-item:read': ['admin', 'operator', 'approver', 'auditor'],
  'run:start': ['admin', 'operator'],
  'approval:submit': ['admin', 'approver'],
  'workforce:assign': ['admin', 'operator'],
};

export function isAllowedWorkspaceAction(
  actor: Pick<WorkspaceActor, 'roles'>,
  action: AppAction,
): boolean {
  const required = ACTION_MATRIX[action];
  return required.some((role) => actor.roles.includes(role));
}

export function assertCanPerformWorkspaceAction(
  actor: Pick<WorkspaceActor, 'roles'>,
  action: AppAction,
): void {
  const required = ACTION_MATRIX[action];
  if (required.some((role) => actor.roles.includes(role))) return;

  throw new WorkspaceAuthorizationError(
    `Actor lacks required role for ${action}.`,
    action,
    required,
    actor.roles,
  );
}
