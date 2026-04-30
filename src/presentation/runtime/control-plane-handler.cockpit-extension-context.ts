import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppContext } from '../../application/common/context.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  EMPTY_COCKPIT_EXTENSION_ACTIVATION_SOURCE,
  type CockpitExtensionActivationState,
} from '../../application/ports/cockpit-extension-activation-source.js';
import {
  type ControlPlaneDeps,
  assertReadAccess,
  assertWorkspaceScope,
  authenticate,
  checkIfNoneMatch,
  computeETag,
  problemFromError,
  respondJson,
  respondProblem,
} from './control-plane-handler.shared.js';

type CockpitExtensionContextArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  traceContext: TraceContext;
  workspaceId: string;
}>;

export type CockpitExtensionContextResponse = Readonly<{
  schemaVersion: 1;
  workspaceId: string;
  principalId: string;
  persona?: string;
  availablePersonas: readonly string[];
  availableCapabilities: readonly string[];
  availableApiScopes: readonly string[];
  activePackIds: readonly string[];
  quarantinedExtensionIds: readonly string[];
  issuedAtIso: string;
  expiresAtIso: string;
}>;

const ROLE_PERSONAS = [
  { role: 'operator', persona: 'Operator' },
  { role: 'approver', persona: 'Approver' },
  { role: 'auditor', persona: 'Auditor' },
  { role: 'admin', persona: 'Admin' },
] as const;

const CONTEXT_TTL_MS = 5 * 60 * 1000;

export async function handleGetCockpitExtensionContext(
  args: CockpitExtensionContextArgs,
): Promise<void> {
  const { deps, req, res, correlationId, pathname, traceContext, workspaceId } = args;

  const auth = await authenticate(deps, {
    req,
    correlationId,
    traceContext,
    expectedWorkspaceId: workspaceId,
  });
  if (!auth.ok) {
    respondProblem(res, problemFromError(auth.error, pathname), correlationId, traceContext);
    return;
  }

  const scopeCheck = assertWorkspaceScope(auth.ctx, workspaceId, deps.authEventLogger);
  if (!scopeCheck.ok) {
    respondProblem(res, problemFromError(scopeCheck.error, pathname), correlationId, traceContext);
    return;
  }

  const readAccess = await assertReadAccess(deps, auth.ctx);
  if (!readAccess.ok) {
    respondProblem(res, problemFromError(readAccess.error, pathname), correlationId, traceContext);
    return;
  }

  const issuedAt = deps.clock?.() ?? new Date();
  const activationState = await resolveActivationState({
    deps,
    ctx: auth.ctx,
    workspaceId,
    correlationId,
    traceContext,
  });
  const body = buildCockpitExtensionContext(auth.ctx, workspaceId, issuedAt, activationState);
  const etag = computeETag(body);
  res.setHeader('ETag', etag);
  if (checkIfNoneMatch(req, etag)) {
    res.statusCode = 304;
    res.setHeader('x-correlation-id', correlationId);
    res.end();
    return;
  }

  respondJson(res, { statusCode: 200, correlationId, traceContext, body });
}

function buildCockpitExtensionContext(
  ctx: AppContext,
  workspaceId: string,
  issuedAt: Date,
  activationState: CockpitExtensionActivationState,
): CockpitExtensionContextResponse {
  const availablePersonas = derivePersonas(ctx);
  const availableScopes = uniqueStrings(ctx.scopes);
  const availableCapabilities = uniqueStrings([
    ...(ctx.capabilities ?? []),
    ...(activationState.availableCapabilities ?? []),
  ]);
  const activationApiScopes = activationState.availableApiScopes ?? [];
  const availableApiScopes =
    activationApiScopes.length > 0
      ? intersectStrings(availableScopes, activationApiScopes)
      : availableScopes;
  const expiresAt = new Date(issuedAt.getTime() + CONTEXT_TTL_MS);

  return {
    schemaVersion: 1,
    workspaceId,
    principalId: String(ctx.principalId),
    ...(availablePersonas[0] ? { persona: availablePersonas[0] } : {}),
    availablePersonas,
    availableCapabilities,
    availableApiScopes,
    activePackIds: normalizeActivationIds(activationState.activePackIds),
    quarantinedExtensionIds: normalizeActivationIds(activationState.quarantinedExtensionIds),
    issuedAtIso: issuedAt.toISOString(),
    expiresAtIso: expiresAt.toISOString(),
  };
}

async function resolveActivationState(
  args: Readonly<{
    deps: ControlPlaneDeps;
    ctx: AppContext;
    workspaceId: string;
    correlationId: string;
    traceContext: TraceContext;
  }>,
): Promise<CockpitExtensionActivationState> {
  const { deps, ctx, workspaceId, correlationId, traceContext } = args;
  const source = deps.cockpitExtensionActivationSource ?? EMPTY_COCKPIT_EXTENSION_ACTIVATION_SOURCE;
  return source.getActivationState({
    workspaceId,
    principalId: String(ctx.principalId),
    roles: ctx.roles,
    scopes: ctx.scopes,
    correlationId,
    traceparent: traceContext.traceparent,
    ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
  });
}

function derivePersonas(ctx: AppContext): readonly string[] {
  const personas = ROLE_PERSONAS.flatMap(({ role, persona }) =>
    ctx.roles.includes(role) ? [persona] : [],
  );
  return uniqueStrings(personas);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizeActivationIds(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function intersectStrings(
  candidates: readonly string[],
  allowed: readonly string[],
): readonly string[] {
  const allowedSet = new Set(allowed);
  return candidates.filter((candidate) => allowedSet.has(candidate));
}
