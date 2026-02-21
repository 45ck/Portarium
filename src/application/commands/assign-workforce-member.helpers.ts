import {
  EvidenceId,
  WorkspaceId,
  type HumanTaskId,
  type UserId,
  type WorkItemId,
  type WorkforceMemberId,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import { err, ok, type Conflict, type DependencyFailure, type Result } from '../common/index.js';
import type {
  AssignWorkforceMemberError,
  AssignWorkforceMemberInput,
} from './assign-workforce-member.types.js';
import type { Clock, IdGenerator } from '../ports/index.js';
import type { AppContext } from '../common/context.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import type { EvidenceEntryAppendInput } from '../ports/index.js';

export type ParsedAssignInput = Readonly<{
  workspaceId: WorkspaceIdType;
  target: AssignWorkforceMemberInput['target'];
}>;

export function validateAssignInput(
  input: AssignWorkforceMemberInput,
): Result<ParsedAssignInput, AssignWorkforceMemberError> {
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }

  if (input.target.kind === 'WorkItem') {
    return validateWorkItemTarget(input, WorkspaceId(input.workspaceId));
  }
  return validateHumanTaskTarget(input, WorkspaceId(input.workspaceId));
}

function validateWorkItemTarget(
  input: AssignWorkforceMemberInput,
  workspaceId: WorkspaceIdType,
): Result<ParsedAssignInput, AssignWorkforceMemberError> {
  if (input.target.kind !== 'WorkItem') {
    return err({ kind: 'ValidationFailed', message: 'Invalid WorkItem target.' });
  }
  if (input.target.workItemId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workItemId must be a non-empty string.' });
  }
  if (input.target.workforceMemberId.trim() === '') {
    return err({
      kind: 'ValidationFailed',
      message: 'workforceMemberId must be a non-empty string.',
    });
  }
  return ok({ workspaceId, target: input.target });
}

function validateHumanTaskTarget(
  input: AssignWorkforceMemberInput,
  workspaceId: WorkspaceIdType,
): Result<ParsedAssignInput, AssignWorkforceMemberError> {
  if (input.target.kind !== 'HumanTask') {
    return err({ kind: 'ValidationFailed', message: 'Invalid HumanTask target.' });
  }
  if (input.target.humanTaskId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'humanTaskId must be a non-empty string.' });
  }
  const hasMember = typeof input.target.workforceMemberId === 'string';
  const hasQueue = typeof input.target.workforceQueueId === 'string';
  if (!hasMember && !hasQueue) {
    return err({
      kind: 'ValidationFailed',
      message: 'HumanTask assignment requires workforceMemberId or workforceQueueId.',
    });
  }
  const memberValidation = validateOptionalId(input.target.workforceMemberId, 'workforceMemberId');
  if (memberValidation) return memberValidation;
  const queueValidation = validateOptionalId(input.target.workforceQueueId, 'workforceQueueId');
  if (queueValidation) return queueValidation;
  return ok({ workspaceId, target: input.target });
}

function validateOptionalId(
  value: string | undefined,
  field: 'workforceMemberId' | 'workforceQueueId',
): Readonly<{ ok: false; error: AssignWorkforceMemberError }> | null {
  if (value === undefined) return null;
  if (value.trim() !== '') return null;
  return err({
    kind: 'ValidationFailed',
    message: `${field} must be a non-empty string when provided.`,
  });
}

export function ensureMemberAvailable(
  availabilityStatus: 'available' | 'busy' | 'offline',
): Result<true, Conflict> {
  if (availabilityStatus === 'available') return ok(true);
  return err({
    kind: 'Conflict',
    message: 'Workforce member is unavailable for assignment.',
  });
}

export function ensureCapabilitiesCovered(
  memberCapabilities: readonly string[],
  requiredCapabilities: readonly string[],
): Result<true, Conflict> {
  const missing = requiredCapabilities.filter((cap) => !memberCapabilities.includes(cap));
  if (missing.length === 0) return ok(true);
  return err({
    kind: 'Conflict',
    message: `Workforce member does not satisfy required capabilities: ${missing.join(', ')}`,
  });
}

export function nextGeneratedId(
  idGenerator: IdGenerator,
  kind: 'event' | 'evidence',
): Result<string, DependencyFailure> {
  const value = idGenerator.generateId();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: `Unable to generate ${kind} identifier.` });
}

export function currentIso(clock: Clock): Result<string, DependencyFailure> {
  const value = clock.nowIso();
  if (value.trim() !== '') return ok(value);
  return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
}

export function buildAssignmentArtifacts(
  ctx: AppContext,
  params: {
    clock: Clock;
    idGenerator: IdGenerator;
    targetKind: 'WorkItem' | 'HumanTask';
    targetId: WorkItemId | HumanTaskId;
    workforceMemberId: WorkforceMemberId;
    ownerUserId: UserId;
    aggregateKind: string;
    aggregateId: string;
    eventPayload: Record<string, unknown>;
    summary: string;
    links?: EvidenceEntryAppendInput['links'];
  },
): Result<
  Readonly<{
    targetKind: 'WorkItem' | 'HumanTask';
    targetId: WorkItemId | HumanTaskId;
    workforceMemberId: WorkforceMemberId;
    ownerUserId: UserId;
    event: DomainEventV1;
    evidence: EvidenceEntryAppendInput;
  }>,
  DependencyFailure
> {
  const occurredAtIso = currentIso(params.clock);
  if (!occurredAtIso.ok) return occurredAtIso;
  const eventId = nextGeneratedId(params.idGenerator, 'event');
  if (!eventId.ok) return eventId;
  const evidenceId = nextGeneratedId(params.idGenerator, 'evidence');
  if (!evidenceId.ok) return evidenceId;

  return ok({
    targetKind: params.targetKind,
    targetId: params.targetId,
    workforceMemberId: params.workforceMemberId,
    ownerUserId: params.ownerUserId,
    event: {
      schemaVersion: 1,
      eventId: eventId.value,
      eventType: 'WorkforceMemberAssigned',
      aggregateKind: params.aggregateKind,
      aggregateId: params.aggregateId,
      occurredAtIso: occurredAtIso.value,
      workspaceId: ctx.tenantId,
      correlationId: ctx.correlationId,
      actorUserId: ctx.principalId,
      payload: params.eventPayload,
    },
    evidence: {
      schemaVersion: 1,
      evidenceId: EvidenceId(evidenceId.value),
      workspaceId: ctx.tenantId,
      correlationId: ctx.correlationId,
      occurredAtIso: occurredAtIso.value,
      category: 'Action',
      summary: params.summary,
      actor: { kind: 'User', userId: ctx.principalId },
      ...(params.links ? { links: params.links } : {}),
    },
  });
}
