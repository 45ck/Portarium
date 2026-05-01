/**
 * Execute an agent action that has been proposed and approved.
 *
 * Guards:
 *   1. Authorization (agent-action:execute).
 *   2. Approval exists and status is 'Approved'.
 *   3. Caller workspaceId matches the approval workspaceId.
 *
 * On success emits AgentActionExecuted; on dispatch failure emits
 * AgentActionExecutionFailed. Both paths record evidence.
 */

import {
  ActionId,
  ApprovalId,
  EvidenceId,
  EventId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  type ApprovalDecidedV1,
  type ApprovalStatus,
  parseApprovalV1,
} from '../../domain/approvals/index.js';
import {
  type AppContext,
  type Conflict,
  type DependencyFailure,
  type Forbidden,
  type NotFound,
  type ValidationFailed,
  APP_ACTIONS,
  err,
  ok,
  type Result,
} from '../common/index.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import type {
  ActionRunnerPort,
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdempotencyStore,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

const EXECUTE_SOURCE = 'portarium.control-plane.agent-actions';
const EXECUTE_COMMAND = 'ExecuteApprovedAgentAction';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ExecuteApprovedAgentActionInput = Readonly<{
  workspaceId: string;
  approvalId: string;
  /** Execution-plane reference (flow ID, pipeline ID, endpoint path). */
  flowRef: string;
  /** Arbitrary action-specific payload forwarded to the execution plane. */
  payload?: Record<string, unknown>;
  /** Optional caller retry key. When omitted, the command derives a stable approval execution key. */
  idempotencyKey?: string;
}>;

export type ExecuteApprovedAgentActionOutput = Readonly<{
  executionId: string;
  approvalId: ApprovalIdType;
  status: 'Executed' | 'Failed';
  output?: unknown;
  errorMessage?: string;
  /** Internal marker used by transports and tests to identify replayed command results. */
  replayed?: boolean;
}>;

export type ExecuteApprovedAgentActionError =
  | Forbidden
  | ValidationFailed
  | NotFound
  | Conflict
  | DependencyFailure;

export interface ExecuteApprovedAgentActionDeps {
  authorization: AuthorizationPort;
  clock: Clock;
  idGenerator: IdGenerator;
  approvalStore: ApprovalStore;
  unitOfWork: UnitOfWork;
  eventPublisher: EventPublisher;
  actionRunner: ActionRunnerPort;
  evidenceLog?: EvidenceLogPort;
  idempotency?: IdempotencyStore;
}

type ExecuteIdempotencyEnvelope = Readonly<{
  fingerprint: string;
  output: ExecuteApprovedAgentActionOutput;
}>;

async function saveApprovalIfStatus(
  deps: ExecuteApprovedAgentActionDeps,
  ctx: AppContext,
  workspaceId: WorkspaceIdType,
  approvalId: ApprovalIdType,
  expectedStatus: ApprovalStatus,
  approval: ApprovalDecidedV1,
): Promise<boolean> {
  if (deps.approvalStore.saveApprovalIfStatus) {
    return deps.approvalStore.saveApprovalIfStatus(
      ctx.tenantId,
      workspaceId,
      approvalId,
      expectedStatus,
      approval,
    );
  }

  const latest = await deps.approvalStore.getApprovalById(ctx.tenantId, workspaceId, approvalId);
  if (latest?.status !== expectedStatus) return false;
  await deps.approvalStore.saveApproval(ctx.tenantId, approval);
  return true;
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

function normalizeCachedOutput(value: unknown): ExecuteApprovedAgentActionOutput | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const status = record['status'];
  if (status !== 'Executed' && status !== 'Failed') return null;
  if (typeof record['executionId'] !== 'string' || record['executionId'].trim() === '') {
    return null;
  }
  if (typeof record['approvalId'] !== 'string' || record['approvalId'].trim() === '') {
    return null;
  }
  return {
    executionId: record['executionId'],
    approvalId: ApprovalId(record['approvalId']),
    status,
    ...(record['output'] !== undefined ? { output: record['output'] } : {}),
    ...(typeof record['errorMessage'] === 'string' ? { errorMessage: record['errorMessage'] } : {}),
    replayed: true,
  };
}

function normalizeCachedEnvelope(value: unknown): ExecuteIdempotencyEnvelope | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record['fingerprint'] !== 'string') return null;
  const output = normalizeCachedOutput(record['output']);
  if (!output) return null;
  return { fingerprint: record['fingerprint'], output };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function executeApprovedAgentAction(
  deps: ExecuteApprovedAgentActionDeps,
  ctx: AppContext,
  input: ExecuteApprovedAgentActionInput,
): Promise<Result<ExecuteApprovedAgentActionOutput, ExecuteApprovedAgentActionError>> {
  // --- Validation ---
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  if (typeof input.approvalId !== 'string' || input.approvalId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'approvalId must be a non-empty string.' });
  }
  if (typeof input.flowRef !== 'string' || input.flowRef.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'flowRef must be a non-empty string.' });
  }
  if (input.idempotencyKey !== undefined) {
    if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.trim() === '') {
      return err({
        kind: 'ValidationFailed',
        message: 'idempotencyKey must be a non-empty string when present.',
      });
    }
  }

  // --- Authorization ---
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.agentActionExecute);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionExecute,
      message: 'Caller is not permitted to execute agent actions.',
    });
  }

  // --- Parse IDs ---
  let workspaceId: WorkspaceIdType;
  let approvalId: ApprovalIdType;
  try {
    workspaceId = WorkspaceId(input.workspaceId);
    approvalId = ApprovalId(input.approvalId);
  } catch {
    return err({ kind: 'ValidationFailed', message: 'Invalid workspaceId or approvalId.' });
  }

  // --- Load and guard approval ---
  const approval = await deps.approvalStore.getApprovalById(ctx.tenantId, workspaceId, approvalId);
  if (approval === null) {
    return err({
      kind: 'NotFound',
      resource: 'Approval',
      message: `Approval ${input.approvalId} not found.`,
    });
  }

  if (String(approval.workspaceId) !== input.workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionExecute,
      message: 'Approval workspace does not match requested workspace.',
    });
  }

  if (
    'decidedByUserId' in approval &&
    String(approval.decidedByUserId) === String(ctx.principalId)
  ) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionExecute,
      message: 'Maker-checker violation: the approval decider cannot execute the same action.',
    });
  }

  const providedIdempotencyKey = input.idempotencyKey?.trim();
  const dispatchIdempotencyKey =
    providedIdempotencyKey !== undefined && providedIdempotencyKey !== ''
      ? providedIdempotencyKey
      : `${EXECUTE_COMMAND}:${String(ctx.tenantId)}:${String(workspaceId)}:${String(approvalId)}:${input.flowRef}`;

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: EXECUTE_COMMAND,
    requestKey: dispatchIdempotencyKey,
  };
  const idempotencyFingerprint = stableJson({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    flowRef: input.flowRef,
    payload: input.payload ?? {},
    principalId: String(ctx.principalId),
  });

  if (deps.idempotency) {
    const cached = await deps.idempotency.get<unknown>(commandKey);
    const cachedEnvelope = normalizeCachedEnvelope(cached);
    if (cachedEnvelope) {
      if (cachedEnvelope.fingerprint !== idempotencyFingerprint) {
        return err({
          kind: 'Conflict',
          message:
            'Idempotency-Key was already used for a different approved action execution request.',
        });
      }
      return ok({ ...cachedEnvelope.output, replayed: true });
    }
    const cachedOutput = normalizeCachedOutput(cached);
    if (cachedOutput) {
      return ok({ ...cachedOutput, replayed: true });
    }
  }

  if (approval.status !== 'Approved') {
    return err({
      kind: 'Conflict',
      message: `Approval ${input.approvalId} is not in Approved status (current: ${approval.status}).`,
    });
  }

  // Stable across retries so execution-plane dedupe can key on both actionId and Idempotency-Key.
  const executionId = dispatchIdempotencyKey;
  const executedAtIso = deps.clock.nowIso();
  if (executedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const executionClaim: ApprovalDecidedV1 = parseApprovalV1({
    ...approval,
    status: 'Executing',
    decidedAtIso: executedAtIso,
    decidedByUserId: approval.decidedByUserId,
    rationale: `Execution claimed (executionId: ${executionId})`,
  }) as ApprovalDecidedV1;

  try {
    const claimed = await saveApprovalIfStatus(
      deps,
      ctx,
      workspaceId,
      approvalId,
      'Approved',
      executionClaim,
    );
    if (!claimed) {
      return err({
        kind: 'Conflict',
        message: `Approval ${input.approvalId} is already being executed or is no longer Approved.`,
      });
    }
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message:
        error instanceof Error ? error.message : 'Failed to claim approved action execution.',
    });
  }

  // --- Dispatch through action runner ---
  const dispatchResult = await deps.actionRunner.dispatchAction({
    actionId: ActionId(executionId),
    idempotencyKey: dispatchIdempotencyKey,
    tenantId: ctx.tenantId,
    runId: approval.runId,
    correlationId: ctx.correlationId,
    flowRef: input.flowRef,
    payload: input.payload ?? {},
  });

  // --- Build domain event ---
  const eventId = deps.idGenerator.generateId();
  const eventType = dispatchResult.ok ? 'AgentActionExecuted' : 'AgentActionExecutionFailed';
  const domainEvent: DomainEventV1 = {
    schemaVersion: 1,
    eventId: EventId(eventId),
    eventType,
    aggregateKind: 'AgentActionProposal',
    aggregateId: approvalId,
    occurredAtIso: executedAtIso,
    workspaceId: ctx.tenantId,
    correlationId: ctx.correlationId,
    actorUserId: ctx.principalId,
    payload: {
      executionId,
      approvalId: String(approvalId),
      ...(dispatchResult.ok
        ? { output: dispatchResult.output }
        : { errorKind: dispatchResult.errorKind, errorMessage: dispatchResult.message }),
    },
  };

  // --- Persist event + evidence ---
  try {
    await deps.unitOfWork.execute(async () => {
      // Mark approval as Executed to prevent double-execution on retry.
      // Only update to terminal 'Executed' state when dispatch succeeded.
      if (dispatchResult.ok) {
        const finalized = await saveApprovalIfStatus(
          deps,
          ctx,
          workspaceId,
          approvalId,
          'Executing',
          {
            ...approval,
            status: 'Executed',
            decidedAtIso: executedAtIso,
            decidedByUserId: approval.decidedByUserId,
            rationale: `Executed via action runner (executionId: ${executionId})`,
          },
        );
        if (!finalized) {
          throw new Error(
            `Approval ${String(approvalId)} execution claim was lost before finalize.`,
          );
        }
      } else {
        const released = await saveApprovalIfStatus(
          deps,
          ctx,
          workspaceId,
          approvalId,
          'Executing',
          approval,
        );
        if (!released) {
          throw new Error(
            `Approval ${String(approvalId)} execution claim was lost before release.`,
          );
        }
      }

      await deps.eventPublisher.publish(
        domainEventToPortariumCloudEvent(domainEvent, EXECUTE_SOURCE, ctx.traceparent),
      );

      if (deps.evidenceLog) {
        const evidenceIdRaw = deps.idGenerator.generateId();
        await deps.evidenceLog.appendEntry(ctx.tenantId, {
          schemaVersion: 1,
          evidenceId: EvidenceId(evidenceIdRaw),
          workspaceId,
          correlationId: ctx.correlationId,
          occurredAtIso: executedAtIso,
          category: 'Action',
          summary: dispatchResult.ok
            ? `Agent action executed: approval ${String(approvalId)}`
            : `Agent action execution failed: approval ${String(approvalId)} — ${dispatchResult.message}`,
          actor: { kind: 'User', userId: ctx.principalId },
          links: {
            approvalId,
            runId: approval.runId,
            planId: approval.planId,
          },
        });
      }

      if (deps.idempotency) {
        const output: ExecuteApprovedAgentActionOutput = dispatchResult.ok
          ? {
              executionId,
              approvalId,
              status: 'Executed',
              output: dispatchResult.output,
            }
          : {
              executionId,
              approvalId,
              status: 'Failed',
              errorMessage: dispatchResult.message,
            };
        await deps.idempotency.set(commandKey, {
          fingerprint: idempotencyFingerprint,
          output,
        });
      }
    });
  } catch (error) {
    return err({
      kind: 'DependencyFailure',
      message: error instanceof Error ? error.message : 'Failed to persist execution event.',
    });
  }

  if (dispatchResult.ok) {
    return ok({
      executionId,
      approvalId,
      status: 'Executed',
      output: dispatchResult.output,
    });
  }

  return ok({
    executionId,
    approvalId,
    status: 'Failed',
    errorMessage: dispatchResult.message,
  });
}
