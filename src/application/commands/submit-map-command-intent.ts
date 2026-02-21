import type { PolicyV1 } from '../../domain/policy/index.js';
import type {
  AppContext,
  DependencyFailure,
  NotFound,
  Result,
  ValidationFailed,
} from '../common/index.js';
import { APP_ACTIONS, err, ok } from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../ports/index.js';
import {
  type ParsedSubmitMapCommandIntentInput,
  type SubmitMapCommandIntentInput as SubmitMapCommandIntentInputFromHelpers,
  type SubmitMapCommandIntentOutput as SubmitMapCommandIntentOutputFromHelpers,
  type SubmitMapCommandIntentPolicyError,
  evaluateMapCommandGovernance,
  parseSubmitMapCommandIntentInput,
  toMapCommandPolicyGateError,
} from './submit-map-command-intent.helpers.js';
import {
  buildMapCommandAuditArtifacts,
  type MapCommandAuditArtifacts,
} from './submit-map-command-intent.audit.js';

const SUBMIT_MAP_COMMAND_INTENT_SOURCE = 'portarium.control-plane.map-governance';

export type SubmitMapCommandIntentError =
  | SubmitMapCommandIntentPolicyError
  | ValidationFailed
  | NotFound
  | DependencyFailure;

export interface SubmitMapCommandIntentDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  unitOfWork: UnitOfWork;
  policyStore: PolicyStore;
  eventPublisher: EventPublisher;
  evidenceLog: EvidenceLogPort;
}

async function loadPolicies(
  deps: SubmitMapCommandIntentDeps,
  ctx: AppContext,
  parsedInput: ParsedSubmitMapCommandIntentInput,
): Promise<Result<readonly PolicyV1[], NotFound>> {
  const policies: PolicyV1[] = [];
  for (const policyId of parsedInput.policyIds) {
    const policy = await deps.policyStore.getPolicyById(
      ctx.tenantId,
      parsedInput.workspaceId,
      policyId,
    );
    if (policy === null) {
      return err({
        kind: 'NotFound',
        resource: 'Policy',
        message: `Policy ${policyId} not found for workspace ${parsedInput.workspaceId}.`,
      });
    }
    policies.push(policy);
  }
  return ok(policies);
}

function nextId(idGenerator: IdGenerator, idLabel: string): Result<string, DependencyFailure> {
  const id = idGenerator.generateId();
  if (id.trim() !== '') return ok(id);
  return err({
    kind: 'DependencyFailure',
    message: `Unable to generate ${idLabel} identifier.`,
  });
}

function nowIso(clock: Clock): Result<string, DependencyFailure> {
  const now = clock.nowIso();
  if (now.trim() !== '') return ok(now);
  return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
}

function buildAuditArtifacts(
  deps: SubmitMapCommandIntentDeps,
  ctx: AppContext,
  parsedInput: ParsedSubmitMapCommandIntentInput,
  evaluation: ReturnType<typeof evaluateMapCommandGovernance>,
): Result<MapCommandAuditArtifacts, DependencyFailure> {
  const commandIntentId = nextId(deps.idGenerator, 'map-command-intent');
  if (!commandIntentId.ok) return commandIntentId;
  const evidenceId = nextId(deps.idGenerator, 'evidence');
  if (!evidenceId.ok) return evidenceId;
  const eventId = nextId(deps.idGenerator, 'event');
  if (!eventId.ok) return eventId;
  const occurredAtIso = nowIso(deps.clock);
  if (!occurredAtIso.ok) return occurredAtIso;

  return ok(
    buildMapCommandAuditArtifacts({
      commandIntentId: commandIntentId.value,
      evidenceId: evidenceId.value,
      eventId: eventId.value,
      occurredAtIso: occurredAtIso.value,
      input: parsedInput,
      evaluation,
      workspaceId: ctx.tenantId,
      correlationId: ctx.correlationId,
      actorUserId: ctx.principalId,
    }),
  );
}

async function persistAuditArtifacts(
  deps: SubmitMapCommandIntentDeps,
  ctx: AppContext,
  audit: MapCommandAuditArtifacts,
): Promise<Result<true, DependencyFailure>> {
  try {
    await deps.unitOfWork.execute(async () => {
      await deps.evidenceLog.appendEntry(ctx.tenantId, audit.evidence);
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(audit.event, SUBMIT_MAP_COMMAND_INTENT_SOURCE),
      );
    });
    return ok(true);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to persist map command intent audit trail.',
    });
  }
}

export async function submitMapCommandIntent(
  deps: SubmitMapCommandIntentDeps,
  ctx: AppContext,
  input: SubmitMapCommandIntentInput,
): Promise<Result<SubmitMapCommandIntentOutput, SubmitMapCommandIntentError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.mapCommandSubmit);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.mapCommandSubmit,
      message: 'Caller is not permitted to submit high-risk map commands.',
    });
  }

  const parsedInput = parseSubmitMapCommandIntentInput({
    ...input,
    requestedByUserId: input.requestedByUserId ?? ctx.principalId.toString(),
  });
  if (!parsedInput.ok) return parsedInput;

  if (parsedInput.value.workspaceId !== ctx.tenantId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.mapCommandSubmit,
      message: 'Workspace mismatch for map command intent request.',
    });
  }

  const policies = await loadPolicies(deps, ctx, parsedInput.value);
  if (!policies.ok) return policies;

  const evaluation = evaluateMapCommandGovernance({
    policies: policies.value,
    input: parsedInput.value,
  });

  const auditResult = buildAuditArtifacts(deps, ctx, parsedInput.value, evaluation);
  if (!auditResult.ok) return auditResult;
  const persistResult = await persistAuditArtifacts(deps, ctx, auditResult.value);
  if (!persistResult.ok) return persistResult;

  const gateError = toMapCommandPolicyGateError({
    evaluation,
    evidenceId: auditResult.value.evidenceId,
  });
  if (gateError) return err(gateError);

  return ok({
    commandIntentId: auditResult.value.commandIntentId,
    evidenceId: auditResult.value.evidenceId,
    decision: 'Allow',
  });
}

// Canonical type alias declarations required by the contract test AST scanner.
// SubmitMapCommandIntentInput and SubmitMapCommandIntentOutput are defined in
// the helpers module; we re-declare them here as concrete aliases so that
// TypeScript's ts.isTypeAliasDeclaration() can locate them in this source file.
export type SubmitMapCommandIntentInput = SubmitMapCommandIntentInputFromHelpers;
export type SubmitMapCommandIntentOutput = SubmitMapCommandIntentOutputFromHelpers;
