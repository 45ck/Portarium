import {
  ApprovalId,
  UserId,
  WorkspaceId,
  type ApprovalDecision,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import {
  parseApprovalV1,
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
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

const SUBMIT_APPROVAL_SOURCE = 'portarium.control-plane.approvals';

export type SubmitApprovalInput = Readonly<{
  workspaceId: string;
  approvalId: string;
  decision: ApprovalDecision;
  rationale: string;
  /** SoD constraints to enforce before accepting the decision.  Sourced from the policy
   *  attached to the run.  When absent, no SoD check is performed. */
  sodConstraints?: readonly SodConstraintV1[];
  /** Optional robot context for robot-specific SoD constraints. */
  robotContext?: RobotSodContextV1;
}>;

export type SubmitApprovalOutput = Readonly<{
  approvalId: ApprovalIdType;
  status: ApprovalDecidedV1['status'];
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
}

type ParsedIds = Readonly<{
  workspaceId: WorkspaceIdType;
  approvalId: ApprovalIdType;
}>;

type Err<E> = Readonly<{ ok: false; error: E }>;

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
  return null;
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
  robotContext: RobotSodContextV1 | undefined,
): Err<SubmitApprovalError> | null {
  if (!sodConstraints || sodConstraints.length === 0) return null;

  const violations = evaluateApprovalRoutingSodV1({
    approval,
    proposedApproverId: UserId(proposedApproverId),
    constraints: sodConstraints,
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
    eventId: args.eventId,
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

async function persistDecision(
  args: PersistArgs,
): Promise<Result<SubmitApprovalOutput, DependencyFailure>> {
  const { deps, ctx, ids, decided, domainEvent } = args;
  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.approvalStore.saveApproval(ctx.tenantId, decided);
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, SUBMIT_APPROVAL_SOURCE, ctx.traceparent),
      );
      return ok({ approvalId: ids.approvalId, status: decided.status });
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

  const stateError = guardPendingState(current, input.approvalId, ids.workspaceId);
  if (stateError) return stateError;

  // current.status === 'Pending' is guaranteed after guardPendingState
  const sodError = guardSodConstraints(
    current as ApprovalPendingV1,
    ctx.principalId.toString(),
    input.sodConstraints,
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

  return persistDecision({ deps, ctx, ids, decided, domainEvent });
}
