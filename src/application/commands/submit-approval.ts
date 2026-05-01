import {
  ApprovalId,
  EvidenceId,
  EventId,
  ProposalId,
  UserId,
  WorkspaceId,
  type ApprovalDecision,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import {
  parseApprovalV1,
  type ApprovalStatus,
  type ApprovalDecidedV1,
  type ApprovalPendingV1,
} from '../../domain/approvals/index.js';
import {
  evaluateApprovalRoutingSodV1,
  type RobotSodContextV1,
  type SodConstraintV1,
} from '../../domain/policy/sod-constraints-v1.js';
import {
  type AppContext,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  APP_ACTIONS,
  err,
  ok,
  type Result,
  type ValidationFailed,
  type NotFound,
} from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import { type DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  AgentActionProposalStore,
  IdempotencyStore,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

const SUBMIT_APPROVAL_SOURCE = 'portarium.control-plane.approvals';
const SUBMIT_APPROVAL_COMMAND = 'SubmitApproval';

export type SubmitApprovalRobotContextInput = Readonly<{
  hazardousZone?: boolean;
  safetyClassifiedZone?: boolean;
  remoteEstopRequest?: boolean;
  missionProposerUserId?: string;
  estopRequesterUserId?: string;
}>;

export type SubmitApprovalInput = Readonly<{
  workspaceId: string;
  approvalId: string;
  decision: ApprovalDecision;
  rationale: string;
  /** SoD constraints to enforce before accepting the decision.  Sourced from the policy
   *  attached to the run.  When absent, no SoD check is performed. */
  sodConstraints?: readonly SodConstraintV1[];
  /** Approvers that already decided the same approval gate before this submission. */
  previousApproverIds?: readonly string[];
  /** Optional robot context for robot-specific SoD constraints. */
  robotContext?: SubmitApprovalRobotContextInput;
  /** Optional caller-supplied retry key for transport and offline replay safety. */
  idempotencyKey?: string;
}>;

export type SubmitApprovalOutput = Readonly<{
  approvalId: ApprovalIdType;
  status: ApprovalDecision;
  /** Internal marker used by transports to avoid duplicate push broadcasts. */
  replayed?: boolean;
}>;

export type SubmitApprovalError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface SubmitApprovalDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  approvalStore: ApprovalStore;
  unitOfWork: UnitOfWork;
  eventPublisher: EventPublisher;
  evidenceLog?: EvidenceLogPort;
  agentActionProposalStore?: AgentActionProposalStore;
  idempotency?: IdempotencyStore;
}

type ParsedIds = Readonly<{
  workspaceId: WorkspaceIdType;
  approvalId: ApprovalIdType;
}>;

type Err<E> = Readonly<{ ok: false; error: E }>;

type SubmitApprovalIdempotencyEnvelope = Readonly<{
  fingerprint: string;
  output: SubmitApprovalOutput;
}>;

function validateInput(input: SubmitApprovalInput): Err<SubmitApprovalError> | null {
  if (typeof input.rationale !== 'string' || input.rationale.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'rationale must be a non-empty string.' });
  }
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.approvalId !== 'string' || input.approvalId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'approvalId must be a non-empty string.' });
  }
  if (input.previousApproverIds !== undefined) {
    if (!Array.isArray(input.previousApproverIds)) {
      return err({
        kind: 'ValidationFailed',
        message: 'previousApproverIds must be an array of non-empty strings.',
      });
    }
    const hasInvalidId = input.previousApproverIds.some(
      (id) => typeof id !== 'string' || id.trim() === '',
    );
    if (hasInvalidId) {
      return err({
        kind: 'ValidationFailed',
        message: 'previousApproverIds must only contain non-empty strings.',
      });
    }
  }
  if (input.robotContext !== undefined) {
    if (
      typeof input.robotContext !== 'object' ||
      input.robotContext === null ||
      Array.isArray(input.robotContext)
    ) {
      return err({ kind: 'ValidationFailed', message: 'robotContext must be an object.' });
    }
    const {
      hazardousZone,
      safetyClassifiedZone,
      remoteEstopRequest,
      missionProposerUserId,
      estopRequesterUserId,
    } = input.robotContext;
    if (hazardousZone !== undefined && typeof hazardousZone !== 'boolean') {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext.hazardousZone must be a boolean.',
      });
    }
    if (safetyClassifiedZone !== undefined && typeof safetyClassifiedZone !== 'boolean') {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext.safetyClassifiedZone must be a boolean.',
      });
    }
    if (remoteEstopRequest !== undefined && typeof remoteEstopRequest !== 'boolean') {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext.remoteEstopRequest must be a boolean.',
      });
    }
    if (
      missionProposerUserId !== undefined &&
      (typeof missionProposerUserId !== 'string' || missionProposerUserId.trim() === '')
    ) {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext.missionProposerUserId must be a non-empty string.',
      });
    }
    if (
      estopRequesterUserId !== undefined &&
      (typeof estopRequesterUserId !== 'string' || estopRequesterUserId.trim() === '')
    ) {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext.estopRequesterUserId must be a non-empty string.',
      });
    }
  }
  if (input.idempotencyKey !== undefined) {
    if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
      return err({
        kind: 'ValidationFailed',
        message: 'idempotencyKey must be a non-empty string when present.',
      });
    }
  }
  return null;
}

function readIdempotencyKey(input: SubmitApprovalInput): string | undefined {
  return typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim() !== ''
    ? input.idempotencyKey
    : undefined;
}

function commandKey(ctx: AppContext, requestKey: string) {
  return {
    tenantId: ctx.tenantId,
    commandName: SUBMIT_APPROVAL_COMMAND,
    requestKey,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintInput(ctx: AppContext, input: SubmitApprovalInput): string {
  return stableJson({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    decision: input.decision,
    rationale: input.rationale,
    principalId: String(ctx.principalId),
    sodConstraints: input.sodConstraints ?? [],
    previousApproverIds: input.previousApproverIds ?? [],
    robotContext: input.robotContext ?? {},
  });
}

function normalizeCachedOutput(value: unknown): SubmitApprovalOutput | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const status = record['status'];
  if (status !== 'Approved' && status !== 'Denied' && status !== 'RequestChanges') return null;
  const approvalId = record['approvalId'];
  if (typeof approvalId !== 'string' || approvalId.trim() === '') return null;
  return { approvalId: ApprovalId(approvalId), status, replayed: true };
}

function normalizeCachedEnvelope(value: unknown): SubmitApprovalIdempotencyEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record['fingerprint'] !== 'string') return null;
  const output = normalizeCachedOutput(record['output']);
  if (!output) return null;
  return { fingerprint: record['fingerprint'], output };
}

function parseIds(input: SubmitApprovalInput): Result<ParsedIds, ValidationFailed> {
  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      approvalId: ApprovalId(input.approvalId),
    });
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or approvalId.' });
  }
}

function parseExistingApproval(
  existing: unknown,
): Result<ReturnType<typeof parseApprovalV1>, DependencyFailure> {
  try {
    return ok(parseApprovalV1(existing));
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Stored approval is invalid.',
    });
  }
}

function guardPendingState(
  current: ReturnType<typeof parseApprovalV1>,
  approvalId: string,
  workspaceId: WorkspaceIdType,
): Err<SubmitApprovalError> | null {
  if (current.status !== 'Pending') {
    return err({ kind: 'Conflict', message: `Approval ${approvalId} is already decided.` });
  }
  if (current.workspaceId !== workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalSubmit,
      message: 'Approval workspace does not match requested workspace.',
    });
  }
  return null;
}

function guardSodConstraints(
  approval: ApprovalPendingV1,
  proposedApproverId: string,
  sodConstraints: readonly SodConstraintV1[] | undefined,
  previousApproverIds: readonly string[] | undefined,
  robotContextInput: SubmitApprovalRobotContextInput | undefined,
): Err<SubmitApprovalError> | null {
  if (!sodConstraints || sodConstraints.length === 0) return null;

  let normalizedPreviousApproverIds: readonly ReturnType<typeof UserId>[] | undefined;
  if (previousApproverIds && previousApproverIds.length > 0) {
    try {
      normalizedPreviousApproverIds = previousApproverIds.map((id) => UserId(id));
    } catch {
      return err({
        kind: 'ValidationFailed',
        message: 'previousApproverIds contains an invalid user identifier.',
      });
    }
  }

  let robotContext: RobotSodContextV1 | undefined;
  if (robotContextInput) {
    try {
      robotContext = {
        ...(robotContextInput.hazardousZone !== undefined
          ? { hazardousZone: robotContextInput.hazardousZone }
          : {}),
        ...(robotContextInput.safetyClassifiedZone !== undefined
          ? { safetyClassifiedZone: robotContextInput.safetyClassifiedZone }
          : {}),
        ...(robotContextInput.remoteEstopRequest !== undefined
          ? { remoteEstopRequest: robotContextInput.remoteEstopRequest }
          : {}),
        ...(robotContextInput.missionProposerUserId
          ? { missionProposerUserId: UserId(robotContextInput.missionProposerUserId) }
          : {}),
        ...(robotContextInput.estopRequesterUserId
          ? { estopRequesterUserId: UserId(robotContextInput.estopRequesterUserId) }
          : {}),
      };
    } catch {
      return err({
        kind: 'ValidationFailed',
        message: 'robotContext contains an invalid user identifier.',
      });
    }
  }

  const violations = evaluateApprovalRoutingSodV1({
    approval,
    proposedApproverId: UserId(proposedApproverId),
    constraints: sodConstraints,
    ...(normalizedPreviousApproverIds
      ? { previousApproverIds: normalizedPreviousApproverIds }
      : {}),
    ...(robotContext ? { robotContext } : {}),
  });

  if (violations.length === 0) return null;

  const firstViolation = violations[0]!;
  return err({
    kind: 'Forbidden',
    action: APP_ACTIONS.approvalSubmit,
    message: `SoD violation: ${firstViolation.kind}`,
  });
}

function agentActionLinkConflict(approvalId: ApprovalIdType): Err<SubmitApprovalError> {
  return err({
    kind: 'Conflict',
    message: `Approval ${String(approvalId)} is not linked to a persisted agent action proposal.`,
  });
}

async function guardLinkedAgentActionProposal(
  deps: SubmitApprovalDeps,
  ctx: AppContext,
  approval: ApprovalPendingV1,
): Promise<Err<SubmitApprovalError> | null> {
  const store = deps.agentActionProposalStore;
  if (!store) return null;

  try {
    const byApprovalId = await store.getProposalByApprovalId(ctx.tenantId, approval.approvalId);
    if (byApprovalId) {
      const proposalId = String(byApprovalId.proposalId);
      if (
        String(byApprovalId.workspaceId) !== String(approval.workspaceId) ||
        String(byApprovalId.approvalId ?? '') !== String(approval.approvalId) ||
        proposalId !== String(approval.runId) ||
        proposalId !== String(approval.planId)
      ) {
        return agentActionLinkConflict(approval.approvalId);
      }
      return null;
    }

    if (String(approval.runId) !== String(approval.planId)) return null;

    const byProposalId = await store.getProposalById(
      ctx.tenantId,
      ProposalId(String(approval.runId)),
    );
    if (
      !byProposalId ||
      String(byProposalId.workspaceId) !== String(approval.workspaceId) ||
      String(byProposalId.approvalId ?? '') !== String(approval.approvalId)
    ) {
      return agentActionLinkConflict(approval.approvalId);
    }
    return null;
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message:
        error instanceof Error ? error.message : 'Failed to verify linked agent action proposal.',
    });
  }
}

function buildDecidedApproval(
  current: ReturnType<typeof parseApprovalV1>,
  input: SubmitApprovalInput,
  decidedAtIso: string,
  decidedByUserId: string,
): ApprovalDecidedV1 {
  return {
    ...current,
    status: input.decision,
    decidedAtIso,
    decidedByUserId: UserId(decidedByUserId),
    rationale: input.rationale,
  };
}

type EventBuildArgs = Readonly<{
  decision: ApprovalDecision;
  ids: ParsedIds;
  ctx: AppContext;
  eventId: string;
  decidedAtIso: string;
  decided: ApprovalDecidedV1;
}>;

function decisionToEventType(
  decision: ApprovalDecision,
): 'ApprovalGranted' | 'ApprovalDenied' | 'ApprovalChangesRequested' {
  if (decision === 'Approved') return 'ApprovalGranted';
  if (decision === 'RequestChanges') return 'ApprovalChangesRequested';
  return 'ApprovalDenied';
}

function buildDomainEvent(args: EventBuildArgs): DomainEventV1 {
  const eventType = decisionToEventType(args.decision);
  return {
    schemaVersion: 1,
    eventId: EventId(args.eventId),
    eventType,
    aggregateKind: 'Approval',
    aggregateId: args.ids.approvalId,
    occurredAtIso: args.decidedAtIso,
    workspaceId: args.ctx.tenantId,
    correlationId: args.ctx.correlationId,
    actorUserId: args.ctx.principalId,
    payload: args.decided,
  };
}

type PersistArgs = Readonly<{
  deps: SubmitApprovalDeps;
  ctx: AppContext;
  ids: ParsedIds;
  decided: ApprovalDecidedV1;
  domainEvent: DomainEventV1;
}>;

async function saveApprovalIfStatus(
  deps: SubmitApprovalDeps,
  ctx: AppContext,
  ids: ParsedIds,
  expectedStatus: ApprovalStatus,
  decided: ApprovalDecidedV1,
): Promise<boolean> {
  if (deps.approvalStore.saveApprovalIfStatus) {
    return deps.approvalStore.saveApprovalIfStatus(
      ctx.tenantId,
      ids.workspaceId,
      ids.approvalId,
      expectedStatus,
      decided,
    );
  }

  const latest = await deps.approvalStore.getApprovalById(
    ctx.tenantId,
    ids.workspaceId,
    ids.approvalId,
  );
  if (latest?.status !== expectedStatus) return false;
  await deps.approvalStore.saveApproval(ctx.tenantId, decided);
  return true;
}

async function persistDecision(
  args: PersistArgs,
): Promise<Result<SubmitApprovalOutput, Conflict | DependencyFailure>> {
  const { deps, ctx, ids, decided, domainEvent } = args;
  try {
    return await deps.unitOfWork.execute(async () => {
      const wonDecisionClaim = await saveApprovalIfStatus(deps, ctx, ids, 'Pending', decided);
      if (!wonDecisionClaim) {
        return err({
          kind: 'Conflict',
          message: `Approval ${String(ids.approvalId)} is already decided.`,
        });
      }

      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, SUBMIT_APPROVAL_SOURCE, ctx.traceparent),
      );

      // Record the decision in the tamper-evident evidence log when available.
      if (deps.evidenceLog) {
        const evidenceIdRaw = deps.idGenerator.generateId();
        await deps.evidenceLog.appendEntry(ctx.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(evidenceIdRaw),
          workspaceId: ids.workspaceId,
          correlationId: ctx.correlationId,
          occurredAtIso: decided.decidedAtIso,
          category: 'Approval',
          summary: `Approval ${String(ids.approvalId)} decided: ${decided.status} by ${String(ctx.principalId).slice(0, 8)}…`,
          actor: { kind: 'User', userId: ctx.principalId },
          links: {
            approvalId: ids.approvalId,
            runId: decided.runId,
            planId: decided.planId,
          },
        });
      }

      return ok({ approvalId: ids.approvalId, status: decided.status as ApprovalDecision });
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to submit approval decision.',
    });
  }
}

export async function submitApproval(
  deps: SubmitApprovalDeps,
  ctx: AppContext,
  input: SubmitApprovalInput,
): Promise<Result<SubmitApprovalOutput, SubmitApprovalError>> {
  const validationError = validateInput(input);
  if (validationError) return validationError;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.approvalSubmit);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalSubmit,
      message: 'Caller is not permitted to submit approval decisions.',
    });
  }

  const idsResult = parseIds(input);
  if (!idsResult.ok) return idsResult;
  const ids = idsResult.value;

  const existing = await deps.approvalStore.getApprovalById(
    ctx.tenantId,
    ids.workspaceId,
    ids.approvalId,
  );
  if (existing === null) {
    return err({
      kind: 'NotFound',
      resource: 'Approval',
      message: `Approval ${input.approvalId} not found.`,
    });
  }

  const parseResult = parseExistingApproval(existing);
  if (!parseResult.ok) return parseResult;
  const current = parseResult.value;
  const pending = current as ApprovalPendingV1;
  const idempotencyKey = readIdempotencyKey(input);
  const idempotencyFingerprint = fingerprintInput(ctx, input);

  if (deps.idempotency && idempotencyKey) {
    const cached = await deps.idempotency.get<unknown>(commandKey(ctx, idempotencyKey));
    const cachedEnvelope = normalizeCachedEnvelope(cached);
    if (cachedEnvelope) {
      if (cachedEnvelope.fingerprint !== idempotencyFingerprint) {
        return err({
          kind: 'Conflict',
          message: 'Idempotency-Key was already used for a different approval decision request.',
        });
      }
      return ok({ ...cachedEnvelope.output, replayed: true });
    }
    const cachedOutput = normalizeCachedOutput(cached);
    if (cachedOutput) {
      return ok({ ...cachedOutput, replayed: true });
    }
  }

  if (current.status !== 'Pending' && deps.idempotency && idempotencyKey) {
    if (
      current.status === input.decision &&
      'decidedByUserId' in current &&
      String(current.decidedByUserId) === String(ctx.principalId)
    ) {
      const output: SubmitApprovalOutput = {
        approvalId: ids.approvalId,
        status: current.status,
        replayed: true,
      };
      await deps.idempotency.set(commandKey(ctx, idempotencyKey), {
        fingerprint: idempotencyFingerprint,
        output,
      });
      return ok(output);
    }
  }

  const stateError = guardPendingState(current, input.approvalId, ids.workspaceId);
  if (stateError) return stateError;

  const linkedProposalError = await guardLinkedAgentActionProposal(deps, ctx, pending);
  if (linkedProposalError) return linkedProposalError;

  // Unconditional maker-checker: the deciding user must never be the requesting user.
  if (ctx.principalId.toString() === current.requestedByUserId.toString()) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalSubmit,
      message:
        'Maker-checker violation: the deciding user cannot be the same as the requesting user.',
    });
  }

  // current.status === 'Pending' is guaranteed after guardPendingState
  const sodError = guardSodConstraints(
    pending,
    ctx.principalId.toString(),
    input.sodConstraints,
    input.previousApproverIds,
    input.robotContext,
  );
  if (sodError) return sodError;

  const decidedAtIso = deps.clock.nowIso();
  if (decidedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const eventId = deps.idGenerator.generateId();
  if (eventId.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate event identifier.' });
  }

  const decided = buildDecidedApproval(current, input, decidedAtIso, ctx.principalId.toString());
  const domainEvent = buildDomainEvent({
    decision: input.decision,
    ids,
    ctx,
    eventId,
    decidedAtIso,
    decided,
  });

  const result = await persistDecision({ deps, ctx, ids, decided, domainEvent });
  if (result.ok && deps.idempotency && idempotencyKey) {
    await deps.idempotency.set(commandKey(ctx, idempotencyKey), {
      fingerprint: idempotencyFingerprint,
      output: result.value,
    });
  }
  return result;
}
