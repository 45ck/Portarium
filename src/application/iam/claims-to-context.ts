import { type AppContext, toAppContext } from '../common/context.js';
import { parseWorkspaceActorFromClaims, type WorkspaceActor } from './workspace-actor.js';

export type WorkspaceAuthClaimsV1 = Readonly<{
  sub: string;
  workspaceId: string;
  roles: readonly string[];
}>;

export function appContextFromWorkspaceAuthClaims(
  args: Readonly<{
    claims: unknown;
    correlationId: string;
    scopes?: readonly string[];
  }>,
): { actor: WorkspaceActor; ctx: AppContext } {
  const actor = parseWorkspaceActorFromClaims(args.claims);
  const ctx = toAppContext({
    tenantId: actor.workspaceId.toString(),
    principalId: actor.userId.toString(),
    roles: actor.roles,
    scopes: args.scopes ?? [],
    correlationId: args.correlationId,
  });
  return { actor, ctx };
}
