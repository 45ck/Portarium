import {
  ApprovalId,
  EvidenceId,
  PlanId,
  RunId,
  UserId,
  WorkItemId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1, EscalationStepV1 } from '../../domain/approvals/index.js';
import {
  type AppContext,
  type DependencyFailure,
  type Forbidden,
  APP_ACTIONS,
  err,
  ok,
  type Result,
  type ValidationFailed,
} from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import { type DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

const CREATE_APPROVAL_SOURCE = 'portarium.control-plane.approvals';

export type CreateApprovalEscalationStepInput = Readonly<{
  stepOrder: number;
  escalateToUserId: string;
  afterHours: number;
}>;

export type CreateApprovalInput = Readonly<{
  workspaceId: string;
  runId: string;
  planId: string;
  prompt: string;
  workItemId?: string;
  assigneeUserId?: string;
  dueAtIso?: string;
  escalationChain?: readonly CreateApprovalEscalationStepInput[];
}>;

export type CreateApprovalOutput = Readonly<{
  approvalId: ApprovalIdType;
  status: 'Pending';
}>;

export type CreateApprovalError = Forbidden | ValidationFailed | DependencyFailure;

export interface CreateApprovalDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  approvalStore: ApprovalStore;
  unitOfWork: UnitOfWork;
  eventPublisher: EventPublisher;
  evidenceLog?: EvidenceLogPort;
}

type Err<E> = Readonly<{ ok: false; error: E }>;

function validateInput(input: CreateApprovalInput): Err<CreateApprovalError> | null {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.runId !== 'string' || input.runId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'runId must be a non-empty string.' });
  }
  if (typeof input.planId !== 'string' || input.planId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'planId must be a non-empty string.' });
  }
  if (typeof input.prompt !== 'string' || input.prompt.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'prompt must be a non-empty string.' });
  }
  if (input.workItemId !== undefined) {
    if (typeof input.workItemId !== 'string' || input.workItemId.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'workItemId must be a non-empty string.' });
    }
  }
  if (input.assigneeUserId !== undefined) {
    if (typeof input.assigneeUserId !== 'string' || input.assigneeUserId.trim() === '') {
      return err({
        kind: 'ValidationFailed',
        message: 'assigneeUserId must be a non-empty string.',
      });
    }
  }
  if (input.dueAtIso !== undefined) {
    if (typeof input.dueAtIso !== 'string' || input.dueAtIso.trim() === '') {
      return err({ kind: 'ValidationFailed', message: 'dueAtIso must be a non-empty string.' });
    }
  }
  if (input.escalationChain !== undefined) {
    if (!Array.isArray(input.escalationChain)) {
      return err({ kind: 'ValidationFailed', message: 'escalationChain must be an array.' });
    }
    for (const step of input.escalationChain) {
      if (typeof step.stepOrder !== 'number' || !Number.isInteger(step.stepOrder)) {
        return err({
          kind: 'ValidationFailed',
          message: 'escalationChain[].stepOrder must be an integer.',
        });
      }
      if (typeof step.escalateToUserId !== 'string' || step.escalateToUserId.trim() === '') {
        return err({
          kind: 'ValidationFailed',
          message: 'escalationChain[].escalateToUserId must be a non-empty string.',
        });
      }
      if (typeof step.afterHours !== 'number' || !Number.isInteger(step.afterHours)) {
        return err({
          kind: 'ValidationFailed',
          message: 'escalationChain[].afterHours must be an integer.',
        });
      }
    }
  }
  return null;
}

type ParsedIds = Readonly<{
  workspaceId: WorkspaceIdType;
  approvalId: ApprovalIdType;
}>;

function parseIds(
  input: CreateApprovalInput,
  rawApprovalId: string,
): Result<ParsedIds, ValidationFailed> {
  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      approvalId: ApprovalId(rawApprovalId),
    });
  } catch {
    return err({
      kind: 'ValidationFailed',
      message: 'Invalid workspaceId or generated approvalId.',
    });
  }
}

function buildPendingApproval(
  input: CreateApprovalInput,
  ids: ParsedIds,
  requestedAtIso: string,
  requestedByUserId: string,
): ApprovalPendingV1 {
  const escalationChain: readonly EscalationStepV1[] | undefined =
    input.escalationChain && input.escalationChain.length > 0
      ? input.escalationChain.map((s) => ({
          stepOrder: s.stepOrder,
          escalateToUserId: s.escalateToUserId,
          afterHours: s.afterHours,
        }))
      : undefined;

  return {
    schemaVersion: 1,
    approvalId: ids.approvalId,
    workspaceId: ids.workspaceId,
    runId: RunId(input.runId),
    planId: PlanId(input.planId),
    ...(input.workItemId ? { workItemId: WorkItemId(input.workItemId) } : {}),
    prompt: input.prompt,
    requestedAtIso,
    requestedByUserId: UserId(requestedByUserId),
    ...(input.assigneeUserId ? { assigneeUserId: UserId(input.assigneeUserId) } : {}),
    ...(input.dueAtIso ? { dueAtIso: input.dueAtIso } : {}),
    ...(escalationChain ? { escalationChain } : {}),
    status: 'Pending',
  };
}

function buildDomainEvent(
  ids: ParsedIds,
  ctx: AppContext,
  eventId: string,
  requestedAtIso: string,
  pending: ApprovalPendingV1,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId,
    eventType: 'ApprovalRequested',
    aggregateKind: 'Approval',
    aggregateId: ids.approvalId,
    occurredAtIso: requestedAtIso,
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    actorUserId: ctx.principalId,
    payload: pending,
  };
}

type PersistArgs = Readonly<{
  deps: CreateApprovalDeps;
  ctx: AppContext;
  ids: ParsedIds;
  pending: ApprovalPendingV1;
  domainEvent: DomainEventV1;
}>;

async function persistApproval(
  args: PersistArgs,
): Promise<Result<CreateApprovalOutput, DependencyFailure>> {
  const { deps, ctx, ids, pending, domainEvent } = args;
  try {
    return await deps.unitOfWork.execute(async () => {
      await deps.approvalStore.saveApproval(ctx.tenantId, pending);
      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, CREATE_APPROVAL_SOURCE, ctx.traceparent),
      );

      if (deps.evidenceLog) {
        const evidenceIdRaw = deps.idGenerator.generateId();
        await deps.evidenceLog.appendEntry(ctx.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(evidenceIdRaw),
          workspaceId: ids.workspaceId,
          correlationId: ctx.correlationId,
          occurredAtIso: pending.requestedAtIso,
          category: 'Approval',
          summary: `Approval ${String(ids.approvalId)} requested by ${String(ctx.principalId)}`,
          actor: { kind: 'User', userId: ctx.principalId },
          links: {
            approvalId: ids.approvalId,
            runId: pending.runId,
            planId: pending.planId,
          },
        });
      }

      return ok({ approvalId: ids.approvalId, status: 'Pending' as const });
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to create approval.',
    });
  }
}

export async function createApproval(
  deps: CreateApprovalDeps,
  ctx: AppContext,
  input: CreateApprovalInput,
): Promise<Result<CreateApprovalOutput, CreateApprovalError>> {
  const validationError = validateInput(input);
  if (validationError) return validationError;

  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.approvalCreate);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.approvalCreate,
      message: 'Caller is not permitted to create approvals.',
    });
  }

  const rawApprovalId = deps.idGenerator.generateId();
  if (rawApprovalId.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate approval identifier.' });
  }

  const idsResult = parseIds(input, rawApprovalId);
  if (!idsResult.ok) return idsResult;
  const ids = idsResult.value;

  const requestedAtIso = deps.clock.nowIso();
  if (requestedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const eventId = deps.idGenerator.generateId();
  if (eventId.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate event identifier.' });
  }

  const pending = buildPendingApproval(input, ids, requestedAtIso, ctx.principalId.toString());
  const domainEvent = buildDomainEvent(ids, ctx, eventId, requestedAtIso, pending);

  return persistApproval({ deps, ctx, ids, pending, domainEvent });
}
