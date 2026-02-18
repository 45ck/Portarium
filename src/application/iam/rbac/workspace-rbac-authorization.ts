import type { AuthorizationPort } from '../../ports/authorization.js';
import type { AppContext } from '../../common/context.js';
import type { AppAction } from '../../common/actions.js';
import { isAllowedWorkspaceAction } from './workspace-rbac.js';

/**
 * Default in-process RBAC authorizer for AppAction.
 *
 * This is intentionally simple for the IAM MVP: map AppAction -> required roles.
 * Production hardening (OIDC validation, tenant scoping, resource-level policies)
 * is tracked separately.
 */
export class WorkspaceRbacAuthorization implements AuthorizationPort {
  public isAllowed(ctx: AppContext, action: AppAction): Promise<boolean> {
    return Promise.resolve(isAllowedWorkspaceAction({ roles: ctx.roles }, action));
  }
}
