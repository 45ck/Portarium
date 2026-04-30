import {
  CorrelationId,
  EvidenceId,
  RunId,
  UserId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { EvidenceCategory } from '../../domain/evidence/evidence-entry-v1.js';
import { assertValidRunStatusTransition } from '../../domain/services/run-status-transitions.js';
import type { RunControlState, RunStatus, RunV1 } from '../../domain/runs/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  err,
  ok,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import type { AuthorizationPort, EvidenceLogPort, RunStore } from '../ports/index.js';

export type RunInterventionKind =
  | 'pause'
  | 'resume'
  | 'reroute'
  | 'handoff'
  | 'escalate'
  | 'annotate'
  | 'request-evidence'
  | 'request-more-evidence'
  | 'freeze'
  | 'sandbox'
  | 'emergency-disable';

export type RunInterventionSurface =
  | 'monitoring'
  | 'steering'
  | 'approval'
  | 'policy-change'
  | 'emergency';

export type RunInterventionAuthoritySource =
  | 'workspace-rbac'
  | 'policy-rule'
  | 'run-charter'
  | 'queue-delegation'
  | 'incident-break-glass'
  | 'system-invariant'
  | 'policy-change-approval';

export type OperatorInputEffect =
  | 'current-run-effect'
  | 'approval-gate-effect'
  | 'future-policy-effect'
  | 'workspace-safety-effect'
  | 'context-only';

export type SubmitRunInterventionInput = Readonly<{
  workspaceId: string;
  runId: string;
  interventionType: RunInterventionKind;
  rationale: string;
  target?: string;
  surface?: RunInterventionSurface;
  authoritySource?: RunInterventionAuthoritySource;
  effect?: OperatorInputEffect;
  consequence?: string;
  evidenceRequired?: boolean;
}>;

export type SubmitRunInterventionOutput = RunV1;

export type SubmitRunInterventionError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export type SubmitRunInterventionDeps = Readonly<{
  authorization: AuthorizationPort;
  runStore: RunStore;
  evidenceLog: EvidenceLogPort;
  clock: { nowIso(): string };
  idGenerator: { generateId(): string };
}>;

type ParsedRunInterventionInput = Omit<SubmitRunInterventionInput, 'workspaceId' | 'runId'> &
  Readonly<{
    workspaceId: ReturnType<typeof WorkspaceId>;
    runId: ReturnType<typeof RunId>;
  }>;

const INTERVENTION_TYPES: readonly RunInterventionKind[] = [
  'pause',
  'resume',
  'reroute',
  'handoff',
  'escalate',
  'annotate',
  'request-evidence',
  'request-more-evidence',
  'freeze',
  'sandbox',
  'emergency-disable',
];

const SURFACES: readonly RunInterventionSurface[] = [
  'monitoring',
  'steering',
  'approval',
  'policy-change',
  'emergency',
];

const AUTHORITY_SOURCES: readonly RunInterventionAuthoritySource[] = [
  'workspace-rbac',
  'policy-rule',
  'run-charter',
  'queue-delegation',
  'incident-break-glass',
  'system-invariant',
  'policy-change-approval',
];

const EFFECTS: readonly OperatorInputEffect[] = [
  'current-run-effect',
  'approval-gate-effect',
  'future-policy-effect',
  'workspace-safety-effect',
  'context-only',
];

const TERMINAL_STATUSES: readonly RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];

export async function submitRunIntervention(
  deps: SubmitRunInterventionDeps,
  ctx: AppContext,
  input: SubmitRunInterventionInput,
): Promise<Result<SubmitRunInterventionOutput, SubmitRunInterventionError>> {
  const parsed = validateInput(input);
  if (!parsed.ok) return parsed;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.runIntervene);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runIntervene,
      message: 'Caller is not permitted to intervene in runs.',
    });
  }
  if (!hasInterventionAuthority(ctx.roles, parsed.value.interventionType)) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runIntervene,
      message: `Caller is not permitted to ${parsed.value.interventionType} runs.`,
    });
  }

  const run = await deps.runStore.getRunById(
    ctx.tenantId,
    parsed.value.workspaceId,
    parsed.value.runId,
  );
  if (run === null) {
    return err({
      kind: 'NotFound',
      resource: 'Run',
      message: `Run ${input.runId} not found.`,
    });
  }

  const transition = deriveTransition(run, parsed.value);
  if (!transition.ok) return transition;

  const updatedRun = transition.value;
  try {
    await deps.evidenceLog.appendEntry(ctx.tenantId, {
      schemaVersion: 1,
      evidenceId: EvidenceId(deps.idGenerator.generateId()),
      workspaceId: parsed.value.workspaceId,
      correlationId: CorrelationId(String(run.correlationId)),
      occurredAtIso: deps.clock.nowIso(),
      category: evidenceCategory(parsed.value),
      summary: evidenceSummary(ctx, run, updatedRun, parsed.value),
      actor: { kind: 'User', userId: UserId(String(ctx.principalId)) },
      links: { runId: parsed.value.runId },
    });
  } catch {
    return err({
      kind: 'DependencyFailure',
      message: 'Unable to append run intervention evidence.',
    });
  }
  try {
    await deps.runStore.saveRun(ctx.tenantId, updatedRun);
  } catch {
    return err({
      kind: 'DependencyFailure',
      message: 'Unable to persist run intervention.',
    });
  }

  return ok(updatedRun);
}

function validateInput(
  input: SubmitRunInterventionInput,
): Result<ParsedRunInterventionInput, ValidationFailed> {
  const violations: { field: string; message: string }[] = [];
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    violations.push({ field: 'workspaceId', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    violations.push({ field: 'runId', message: 'runId must be a non-empty string.' });
  }
  if (!INTERVENTION_TYPES.includes(input.interventionType)) {
    violations.push({
      field: 'interventionType',
      message: `interventionType must be one of: ${INTERVENTION_TYPES.join(', ')}.`,
    });
  }
  if (typeof input.rationale !== 'string' || input.rationale.trim().length < 8) {
    violations.push({
      field: 'rationale',
      message: 'rationale must be at least 8 characters.',
    });
  }
  if (requiresTarget(input.interventionType) && !nonEmpty(input.target)) {
    violations.push({
      field: 'target',
      message: `${input.interventionType} requires a target Workforce Member or Workforce Queue.`,
    });
  }
  if (input.surface !== undefined && !SURFACES.includes(input.surface)) {
    violations.push({
      field: 'surface',
      message: `surface must be one of: ${SURFACES.join(', ')}.`,
    });
  }
  if (input.authoritySource !== undefined && !AUTHORITY_SOURCES.includes(input.authoritySource)) {
    violations.push({
      field: 'authoritySource',
      message: `authoritySource must be one of: ${AUTHORITY_SOURCES.join(', ')}.`,
    });
  }
  if (input.effect !== undefined && !EFFECTS.includes(input.effect)) {
    violations.push({
      field: 'effect',
      message: `effect must be one of: ${EFFECTS.join(', ')}.`,
    });
  }

  if (violations.length > 0) {
    return err({
      kind: 'ValidationFailed',
      message: 'Run intervention payload is invalid.',
      errors: violations,
    });
  }

  return ok({
    workspaceId: WorkspaceId(input.workspaceId),
    runId: RunId(input.runId),
    interventionType: input.interventionType,
    rationale: input.rationale,
    ...(input.target !== undefined ? { target: input.target } : {}),
    ...(input.surface !== undefined ? { surface: input.surface } : {}),
    ...(input.authoritySource !== undefined ? { authoritySource: input.authoritySource } : {}),
    ...(input.effect !== undefined ? { effect: input.effect } : {}),
    ...(input.consequence !== undefined ? { consequence: input.consequence } : {}),
    ...(input.evidenceRequired !== undefined ? { evidenceRequired: input.evidenceRequired } : {}),
  });
}

function deriveTransition(run: RunV1, input: ParsedRunInterventionInput): Result<RunV1, Conflict> {
  const { interventionType } = input;
  if (TERMINAL_STATUSES.includes(run.status) && interventionType !== 'annotate') {
    return err({
      kind: 'Conflict',
      message: `Cannot ${interventionType} a terminal Run.`,
    });
  }

  if (
    interventionType === 'resume' &&
    run.status !== 'Paused' &&
    run.status !== 'WaitingForApproval'
  ) {
    return err({
      kind: 'Conflict',
      message: 'Only paused or waiting Runs can be resumed.',
    });
  }

  const status = nextStatus(run.status, interventionType);
  if (status && status !== run.status) {
    try {
      assertValidRunStatusTransition(run.status, status);
    } catch {
      return err({
        kind: 'Conflict',
        message: `Invalid run status transition: ${run.status} -> ${status}.`,
      });
    }
  }
  const controlState = nextControlState(interventionType);
  const ownerId = ownerTarget(interventionType) ? input.target : undefined;

  const updatedRun: RunV1 & { controlState?: RunControlState; operatorOwnerId?: string } = {
    ...run,
    ...(status ? { status } : {}),
    ...(controlState ? { controlState } : {}),
    ...(ownerId ? { operatorOwnerId: ownerId } : {}),
  };
  if (interventionType === 'resume') {
    delete updatedRun.controlState;
    delete updatedRun.operatorOwnerId;
  }

  return ok(updatedRun);
}

function nextStatus(
  status: RunStatus,
  interventionType: RunInterventionKind,
): RunStatus | undefined {
  if (interventionType === 'resume') return 'Running';
  if (
    interventionType === 'pause' ||
    interventionType === 'freeze' ||
    interventionType === 'request-evidence' ||
    interventionType === 'request-more-evidence' ||
    interventionType === 'sandbox' ||
    interventionType === 'emergency-disable' ||
    interventionType === 'escalate'
  ) {
    return 'Paused';
  }
  return status;
}

function nextControlState(interventionType: RunInterventionKind): RunControlState | undefined {
  switch (interventionType) {
    case 'pause':
    case 'request-evidence':
    case 'request-more-evidence':
    case 'escalate':
      return 'blocked';
    case 'freeze':
    case 'emergency-disable':
      return 'frozen';
    case 'sandbox':
      return 'degraded';
    case 'handoff':
    case 'reroute':
      return 'operator-owned';
    case 'resume':
      return undefined;
    case 'annotate':
      return undefined;
  }
}

function ownerTarget(interventionType: RunInterventionKind): boolean {
  return (
    interventionType === 'handoff' ||
    interventionType === 'reroute' ||
    interventionType === 'escalate'
  );
}

function evidenceCategory(input: SubmitRunInterventionInput): EvidenceCategory {
  if (input.interventionType === 'annotate') return 'System';
  if (
    input.interventionType === 'request-more-evidence' ||
    input.interventionType === 'request-evidence'
  ) {
    return 'Approval';
  }
  return 'Action';
}

function evidenceSummary(
  ctx: AppContext,
  previousRun: RunV1,
  updatedRun: RunV1,
  input: ParsedRunInterventionInput,
): string {
  const governanceFunction = governanceFunctionFor(ctx.roles, input.interventionType);
  const authority = input.authoritySource ? ` authority=${input.authoritySource}` : '';
  const surface = input.surface ? ` surface=${input.surface}` : '';
  const target = input.target ? ` target=${input.target}` : '';
  const effect = input.effect ? ` effect=${input.effect}` : '';
  const accountableActor = ` accountableActor=${String(ctx.principalId)}`;
  const transition =
    previousRun.status === updatedRun.status
      ? ` status=${updatedRun.status}`
      : ` transition=${previousRun.status}->${updatedRun.status}`;
  const previousOwner = previousRun.operatorOwnerId
    ? ` previousOwner=${previousRun.operatorOwnerId}`
    : '';
  const newOwner = updatedRun.operatorOwnerId ? ` newOwner=${updatedRun.operatorOwnerId}` : '';
  return `${input.interventionType}:${surface}${authority}${effect}${target} governanceFunction=${governanceFunction}${accountableActor}${transition}${previousOwner}${newOwner} ${input.rationale.trim()}`;
}

function hasInterventionAuthority(
  roles: AppContext['roles'],
  interventionType: RunInterventionKind,
): boolean {
  if (roles.includes('admin')) return true;
  switch (interventionType) {
    case 'request-evidence':
    case 'request-more-evidence':
    case 'reroute':
    case 'escalate':
      return roles.includes('operator') || roles.includes('approver');
    case 'annotate':
      return roles.includes('auditor');
    case 'emergency-disable':
      return false;
    case 'pause':
    case 'resume':
    case 'handoff':
    case 'freeze':
    case 'sandbox':
      return roles.includes('operator');
  }
}

function governanceFunctionFor(
  roles: AppContext['roles'],
  interventionType: RunInterventionKind,
): 'operator' | 'approver' | 'auditor' | 'platform-admin' {
  if (roles.includes('admin')) return 'platform-admin';
  if (interventionType === 'annotate' && roles.includes('auditor')) return 'auditor';
  if (
    (interventionType === 'request-evidence' ||
      interventionType === 'request-more-evidence' ||
      interventionType === 'reroute' ||
      interventionType === 'escalate') &&
    roles.includes('approver')
  ) {
    return 'approver';
  }
  return 'operator';
}

function requiresTarget(interventionType: RunInterventionKind): boolean {
  return (
    interventionType === 'reroute' ||
    interventionType === 'handoff' ||
    interventionType === 'escalate'
  );
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}
