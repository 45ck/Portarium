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
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';

const EXECUTE_SOURCE = 'portarium.control-plane.agent-actions';

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
}>;

export type ExecuteApprovedAgentActionOutput = Readonly<{
  executionId: string;
  approvalId: ApprovalIdType;
  status: 'Executed' | 'Failed';
  output?: unknown;
  errorMessage?: string;
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

  if (approval.status !== 'Approved') {
    return err({
      kind: 'Conflict',
      message: `Approval ${input.approvalId} is not in Approved status (current: ${approval.status}).`,
    });
  }

  if (String(approval.workspaceId) !== input.workspaceId) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionExecute,
      message: 'Approval workspace does not match requested workspace.',
    });
  }

  // --- Generate execution ID ---
  const executionId = deps.idGenerator.generateId();
  if (executionId.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Unable to generate execution identifier.' });
  }

  const executedAtIso = deps.clock.nowIso();
  if (executedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  // --- Dispatch through action runner ---
  const dispatchResult = await deps.actionRunner.dispatchAction({
    actionId: ActionId(executionId),
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
        await deps.approvalStore.saveApproval(ctx.tenantId, {
          ...approval,
          status: 'Executed',
          decidedAtIso: executedAtIso,
          decidedByUserId: ctx.principalId,
          rationale: `Executed via action runner (executionId: ${executionId})`,
        });
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
