import {
  ApprovalId,
  UserId,
  WorkspaceId,
  type ApprovalDecision,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import { parseApprovalV1, type ApprovalDecidedV1, type ApprovalV1 } from '../../domain/approvals/index.js';
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

export async function submitApproval(
  deps: SubmitApprovalDeps,
  ctx: AppContext,
  input: SubmitApprovalInput,
): Promise<Result<SubmitApprovalOutput, SubmitApprovalError>> {
  if (input.decision === 'RequestChanges') {
    return err({
      kind: 'ValidationFailed',
      message: 'RequestChanges is currently not supported in command execution.',
    });
  }

  if (typeof input.rationale !== 'string' || input.rationale.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'rationale must be a non-empty string.' });
  }

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.approvalSubmit);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalSubmit,
      message: 'Caller is not permitted to submit approval decisions.',
    });
  }

  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.approvalId !== 'string' || input.approvalId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'approvalId must be a non-empty string.' });
  }

  let workspaceId: WorkspaceIdType;
  let approvalId: ApprovalIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    approvalId = ApprovalId(input.approvalId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or approvalId.' });
  }

  const existing = await deps.approvalStore.getApprovalById(ctx.tenantId, workspaceId, approvalId);
  if (existing === null) {
    return err({
      kind: 'NotFound',
      resource: 'Approval',
      message: `Approval ${input.approvalId} not found.`,
    });
  }

  let current: ReturnType<typeof parseApprovalV1>;
  try {
    current = parseApprovalV1(existing);
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Stored approval is invalid.',
    });
  }

  if (current.status !== 'Pending') {
    return err({
      kind: 'Conflict',
      message: `Approval ${input.approvalId} is already decided.`,
    });
  }
  if (current.workspaceId !== workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalSubmit,
      message: 'Approval workspace does not match requested workspace.',
    });
  }

  const decidedAtIso = deps.clock.nowIso();
  if (decidedAtIso.trim() === '') {
    return err({
      kind: 'DependencyFailure',
      message: 'Clock returned an invalid timestamp.',
    });
  }

  const decided: ApprovalV1 = {
    ...current,
    status: input.decision,
    decidedAtIso,
    decidedByUserId: UserId(ctx.principalId.toString()),
    rationale: input.rationale,
  };

  const eventType = input.decision === 'Approved' ? 'ApprovalGranted' : 'ApprovalDenied';
  const eventId = deps.idGenerator.generateId();
  if (eventId.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate event identifier.' });
  }
  const domainEvent: DomainEventV1 = {
    schemaVersion: 1,
    eventId,
    eventType,
    aggregateKind: 'Approval',
    aggregateId: approvalId,
    occurredAtIso: decidedAtIso,
    actorUserId: ctx.principalId,
    correlationId: ctx.correlationId,
    payload: decided,
  };

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
          subject: `approvals/${approvalId}`,
          occurredAtIso: decidedAtIso,
          data: domainEvent,
        }),
      );
      return ok({
        approvalId,
        status: decided.status,
      });
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to submit approval decision.',
    });
  }
}
