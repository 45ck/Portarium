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
  'approval:create': ['admin', 'operator'],
  'approval:read': ['admin', 'operator', 'approver', 'auditor'],
  'policy-change:propose': ['admin', 'operator'],
  'policy-change:approve': ['admin', 'approver'],
  'policy-change:rollback': ['admin', 'operator'],
  'evidence:read': ['admin', 'operator', 'approver', 'auditor'],
  'plan:read': ['admin', 'operator', 'approver', 'auditor'],
  'run:read': ['admin', 'operator', 'approver', 'auditor'],
  'work-item:read': ['admin', 'operator', 'approver', 'auditor'],
  'run:start': ['admin', 'operator'],
  'run:intervene': ['admin', 'operator', 'approver', 'auditor'],
  'map-command:submit': ['admin', 'operator'],
  'approval:submit': ['admin', 'approver'],
  'workforce:assign': ['admin', 'operator'],
  'workforce:complete': ['admin', 'operator', 'approver'],
  // Machine / agent identity plane — operators can send heartbeats; only admins can register
  'agent:heartbeat': ['admin', 'operator'],
  'machine-agent:register': ['admin'],
  /** Read machines and agents — available to operators and auditors. */
  'machine-agent:read': ['admin', 'operator', 'auditor'],
  /** Bridge sync is admin-only: syncs agent lifecycle with the OpenClaw gateway. */
  'machine-agent:bridge-sync': ['admin'],
  /** Tool invocation through the Action API — operators can invoke; admins always. */
  'tool:invoke': ['admin', 'operator'],
  /** Propose agent action: operators can propose, admins always can. */
  'agent-action:propose': ['admin', 'operator'],
  /** Execute an approved agent action — operators can execute, admins always can. */
  'agent-action:execute': ['admin', 'operator'],
  /** Generate weekly autonomy digest artifacts. */
  'autonomy-digest:generate': ['admin', 'operator'],
  /** Acknowledge weekly autonomy digest review. */
  'autonomy-digest:acknowledge': ['admin', 'operator', 'approver', 'auditor'],
  /** Draft policy calibration intent from digest recommendations. */
  'policy-calibration:draft': ['admin', 'operator', 'approver'],
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
