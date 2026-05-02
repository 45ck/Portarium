import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AppAction } from '../../application/common/actions.js';
import type { AppContext } from '../../application/common/context.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  EMPTY_COCKPIT_EXTENSION_ACTIVATION_SOURCE,
  type CockpitExtensionActivationState,
} from '../../application/ports/cockpit-extension-activation-source.js';
import {
  COCKPIT_EXTENSION_DATA_QUERY_CONTRACTS,
  COCKPIT_EXTENSION_GOVERNED_COMMAND_CONTRACTS,
  EMPTY_COCKPIT_EXTENSION_HOST_CONTRACT,
  type CockpitExtensionDataQueryContract,
  type CockpitExtensionGovernedCommandContract,
  type CockpitExtensionHostContract,
} from '../../application/ports/cockpit-extension-host-contract.js';
import {
  type ControlPlaneDeps,
  type ProblemDetails,
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
  availablePrivacyClasses: readonly string[];
  activePackIds: readonly string[];
  quarantinedExtensionIds: readonly string[];
  hostContract: CockpitExtensionHostContract;
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
const ACTIVATION_UNAVAILABLE_PROBLEM_DETAIL =
  'Cockpit extension activation is unavailable; extension surfaces are denied by default.';

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
  if (!activationState.ok) {
    respondProblem(
      res,
      extensionActivationUnavailableProblem(pathname),
      correlationId,
      traceContext,
    );
    return;
  }

  const body = await buildCockpitExtensionContext(
    deps,
    auth.ctx,
    workspaceId,
    issuedAt,
    activationState.value,
  );
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

async function buildCockpitExtensionContext(
  deps: ControlPlaneDeps,
  ctx: AppContext,
  workspaceId: string,
  issuedAt: Date,
  activationState: CockpitExtensionActivationState,
): Promise<CockpitExtensionContextResponse> {
  const availablePersonas = derivePersonas(ctx);
  const effectiveAccess = deriveEffectiveAccess(ctx, activationState);
  const expiresAt = new Date(issuedAt.getTime() + CONTEXT_TTL_MS);
  const hostContract = await buildHostContract(deps, ctx, effectiveAccess);

  return {
    schemaVersion: 1,
    workspaceId,
    principalId: String(ctx.principalId),
    ...(availablePersonas[0] ? { persona: availablePersonas[0] } : {}),
    availablePersonas,
    availableCapabilities: effectiveAccess.availableCapabilities,
    availableApiScopes: effectiveAccess.availableApiScopes,
    availablePrivacyClasses: effectiveAccess.availablePrivacyClasses,
    activePackIds: normalizeActivationIds(activationState.activePackIds),
    quarantinedExtensionIds: normalizeActivationIds(activationState.quarantinedExtensionIds),
    hostContract,
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
): Promise<
  | { ok: true; value: CockpitExtensionActivationState }
  | { ok: false; reason: 'unavailable' | 'invalid' }
> {
  const { deps, ctx, workspaceId, correlationId, traceContext } = args;
  const source = deps.cockpitExtensionActivationSource ?? EMPTY_COCKPIT_EXTENSION_ACTIVATION_SOURCE;
  try {
    const state = await source.getActivationState({
      workspaceId,
      principalId: String(ctx.principalId),
      roles: ctx.roles,
      scopes: ctx.scopes,
      correlationId,
      traceparent: traceContext.traceparent,
      ...(traceContext.tracestate ? { tracestate: traceContext.tracestate } : {}),
    });
    if (!isValidActivationState(state)) return { ok: false, reason: 'invalid' };
    return { ok: true, value: state };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function derivePersonas(ctx: AppContext): readonly string[] {
  const personas = ROLE_PERSONAS.flatMap(({ role, persona }) =>
    ctx.roles.includes(role) ? [persona] : [],
  );
  return uniqueStrings(personas);
}

function deriveEffectiveAccess(
  ctx: AppContext,
  activationState: CockpitExtensionActivationState,
): Readonly<{
  availableCapabilities: readonly string[];
  availableApiScopes: readonly string[];
  availablePrivacyClasses: readonly string[];
}> {
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
  const availablePrivacyClasses = normalizeActivationIds(
    activationState.availablePrivacyClasses ?? [],
  );
  return { availableCapabilities, availableApiScopes, availablePrivacyClasses };
}

async function buildHostContract(
  deps: ControlPlaneDeps,
  ctx: AppContext,
  effectiveAccess: Readonly<{
    availableCapabilities: readonly string[];
    availableApiScopes: readonly string[];
    availablePrivacyClasses: readonly string[];
  }>,
): Promise<CockpitExtensionHostContract> {
  const dataQueries = await filterDataQueries(deps, ctx, effectiveAccess);
  const governedCommandRequests = await filterGovernedCommandRequests(deps, ctx, effectiveAccess);
  if (dataQueries.length === 0 && governedCommandRequests.length === 0) {
    return EMPTY_COCKPIT_EXTENSION_HOST_CONTRACT;
  }
  return {
    schemaVersion: 1,
    browserEgress: 'host-api-origins-only',
    credentialAccess: 'none',
    failureMode: 'fail-closed',
    dataQueries,
    governedCommandRequests,
  };
}

async function filterDataQueries(
  deps: ControlPlaneDeps,
  ctx: AppContext,
  effectiveAccess: Readonly<{
    availableCapabilities: readonly string[];
    availableApiScopes: readonly string[];
  }>,
): Promise<readonly CockpitExtensionDataQueryContract[]> {
  const visible: CockpitExtensionDataQueryContract[] = [];
  for (const contract of COCKPIT_EXTENSION_DATA_QUERY_CONTRACTS) {
    if (!isDataQueryConfigured(deps, contract.id)) continue;
    if (!hasRequiredAccess(contract, effectiveAccess)) continue;
    if (!(await allAppActionsAllowed(deps, ctx, contract.requiredAppActions))) continue;
    visible.push(contract);
  }
  return visible;
}

async function filterGovernedCommandRequests(
  deps: ControlPlaneDeps,
  ctx: AppContext,
  effectiveAccess: Readonly<{
    availableCapabilities: readonly string[];
    availableApiScopes: readonly string[];
  }>,
): Promise<readonly CockpitExtensionGovernedCommandContract[]> {
  const visible: CockpitExtensionGovernedCommandContract[] = [];
  for (const contract of COCKPIT_EXTENSION_GOVERNED_COMMAND_CONTRACTS) {
    if (!isGovernedCommandConfigured(deps, contract.id)) continue;
    if (!hasRequiredAccess(contract, effectiveAccess)) continue;
    if (!(await allAppActionsAllowed(deps, ctx, contract.requiredAppActions))) continue;
    visible.push(contract);
  }
  return visible;
}

function isDataQueryConfigured(deps: ControlPlaneDeps, contractId: string): boolean {
  switch (contractId) {
    case 'cockpit.extensionContext.get':
      return true;
    case 'workItems.list':
      return deps.workItemStore !== undefined;
    case 'approvals.list':
      return deps.approvalQueryStore !== undefined;
    case 'evidence.list':
      return deps.evidenceQueryStore !== undefined;
    default:
      return false;
  }
}

function isGovernedCommandConfigured(deps: ControlPlaneDeps, contractId: string): boolean {
  switch (contractId) {
    case 'agentActions.propose':
      return (
        deps.policyStore !== undefined &&
        deps.approvalStore !== undefined &&
        deps.eventPublisher !== undefined &&
        deps.evidenceLog !== undefined
      );
    default:
      return false;
  }
}

function hasRequiredAccess(
  contract: Pick<CockpitExtensionDataQueryContract, 'requiredApiScopes' | 'requiredCapabilities'>,
  effectiveAccess: Readonly<{
    availableCapabilities: readonly string[];
    availableApiScopes: readonly string[];
  }>,
): boolean {
  return (
    containsAll(effectiveAccess.availableApiScopes, contract.requiredApiScopes) &&
    containsAll(effectiveAccess.availableCapabilities, contract.requiredCapabilities)
  );
}

async function allAppActionsAllowed(
  deps: ControlPlaneDeps,
  ctx: AppContext,
  actions: readonly AppAction[],
): Promise<boolean> {
  try {
    for (const action of actions) {
      if (!(await deps.authorization.isAllowed(ctx, action))) return false;
    }
    return true;
  } catch {
    return false;
  }
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

function containsAll(candidates: readonly string[], required: readonly string[]): boolean {
  const candidateSet = new Set(candidates);
  return required.every((requiredValue) => candidateSet.has(requiredValue));
}

function isValidActivationState(value: unknown): value is CockpitExtensionActivationState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    isStringArray(record['activePackIds']) &&
    isStringArray(record['quarantinedExtensionIds']) &&
    (record['availableCapabilities'] === undefined ||
      isStringArray(record['availableCapabilities'])) &&
    (record['availableApiScopes'] === undefined || isStringArray(record['availableApiScopes'])) &&
    (record['availablePrivacyClasses'] === undefined ||
      isStringArray(record['availablePrivacyClasses']))
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function extensionActivationUnavailableProblem(instance: string): ProblemDetails {
  return {
    type: 'https://portarium.dev/problems/service-unavailable',
    title: 'Service Unavailable',
    status: 503,
    detail: ACTIVATION_UNAVAILABLE_PROBLEM_DETAIL,
    instance,
  };
}
