import {
  ApprovalId,
  UserId,
  WorkspaceId,
  type ApprovalDecision,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import { parseApprovalV1, type ApprovalDecidedV1 } from '../../domain/approvals/index.js';
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
import { createPortariumCloudEvent } from '../events/cloudevent.js';
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
  if (input.decision === 'RequestChanges') {
    return err({
      kind: 'ValidationFailed',
      message: 'RequestChanges is currently not supported in command execution.',
    });
  }
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

function buildDomainEvent(args: EventBuildArgs): DomainEventV1 {
  const eventType = args.decision === 'Approved' ? 'ApprovalGranted' : 'ApprovalDenied';
  return {
    schemaVersion: 1,
    eventId: args.eventId,
    eventType,
    aggregateKind: 'Approval',
    aggregateId: args.ids.approvalId,
    occurredAtIso: args.decidedAtIso,
    actorUserId: args.ctx.principalId,
    correlationId: args.ctx.correlationId,
    payload: args.decided,
  };
}

type PersistArgs = Readonly<{
  deps: SubmitApprovalDeps;
  ctx: AppContext;
  ids: ParsedIds;
  decided: ApprovalDecidedV1;
  domainEvent: DomainEventV1;
  eventId: string;
  decidedAtIso: string;
}>;

async function persistDecision(
  args: PersistArgs,
): Promise<Result<SubmitApprovalOutput, DependencyFailure>> {
  const { deps, ctx, ids, decided, domainEvent, eventId, decidedAtIso } = args;
  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.approvalStore.saveApproval(ctx.tenantId, decided);
      await deps.eventPublisher.publish(
        createPortariumCloudEvent({
          source: SUBMIT_APPROVAL_SOURCE,
          eventType: `com.portarium.approval.${domainEvent.eventType}`,
          eventId,
          tenantId: ctx.tenantId,
          correlationId: ctx.correlationId,
          subject: `approvals/${ids.approvalId}`,
          occurredAtIso: decidedAtIso,
          data: domainEvent,
        }),
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

  return persistDecision({ deps, ctx, ids, decided, domainEvent, eventId, decidedAtIso });
}
