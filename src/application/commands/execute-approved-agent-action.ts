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
  AgentActionProposalStore,
} from '../ports/index.js';
import type { AgentActionProposalV1 } from '../../domain/machines/index.js';

const EXECUTE_SOURCE = 'portarium.control-plane.agent-actions';
const EXECUTE_COMMAND = 'ExecuteApprovedAgentAction';
const EXECUTION_RESERVATION_LEASE_MS = 15 * 60 * 1000;

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
  status: 'Executing' | 'Executed' | 'Failed';
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
  actionRunner?: ActionRunnerPort;
  proposalStore?: AgentActionProposalStore;
  evidenceLog?: EvidenceLogPort;
  idempotency?: IdempotencyStore;
}

type ExecuteIdempotencyEnvelope = Readonly<{
  fingerprint: string;
  output: ExecuteApprovedAgentActionOutput;
}>;

type ExistingExecutionReservation =
  | Readonly<{ status: 'None' }>
  | Readonly<{
      status: 'InProgress';
      fingerprint: string;
      leaseExpiresAtIso?: string;
    }>
  | Readonly<{
      status: 'Completed';
      fingerprint: string;
      output: ExecuteApprovedAgentActionOutput;
    }>
  | Readonly<{ status: 'Conflict'; fingerprint?: string }>;

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

function expectedProposalFlowRefs(proposal: AgentActionProposalV1): readonly string[] {
  return [
    String(proposal.toolName),
    ...(proposal.machineId ? [`${String(proposal.machineId)}/${String(proposal.toolName)}`] : []),
  ];
}

function approvedProposalFlowRef(proposal: AgentActionProposalV1): string {
  return proposal.machineId
    ? `${String(proposal.machineId)}/${String(proposal.toolName)}`
    : String(proposal.toolName);
}

function validateApprovedProposalBinding(
  approval: Readonly<{ workspaceId: WorkspaceIdType }>,
  proposal: AgentActionProposalV1 | null,
  input: ExecuteApprovedAgentActionInput,
): ExecuteApprovedAgentActionError | null {
  if (!proposal) {
    return {
      kind: 'NotFound',
      resource: 'AgentActionProposal',
      message: `No stored agent action proposal is linked to approval ${input.approvalId}.`,
    };
  }

  if (String(proposal.workspaceId) !== input.workspaceId) {
    return {
      kind: 'Forbidden',
      action: APP_ACTIONS.agentActionExecute,
      message: 'Stored agent action proposal workspace does not match requested workspace.',
    };
  }

  if (!proposal.approvalId || String(proposal.approvalId) !== input.approvalId) {
    return {
      kind: 'Conflict',
      message: 'Stored agent action proposal is not linked to the requested approval.',
    };
  }

  if (proposal.decision !== 'NeedsApproval') {
    return {
      kind: 'Conflict',
      message: `Stored agent action proposal is not approval-bound (current: ${proposal.decision}).`,
    };
  }

  if (String(approval.workspaceId) !== String(proposal.workspaceId)) {
    return {
      kind: 'Conflict',
      message: 'Approval and stored agent action proposal workspace do not match.',
    };
  }

  const acceptedFlowRefs = expectedProposalFlowRefs(proposal);
  if (!acceptedFlowRefs.includes(input.flowRef)) {
    return {
      kind: 'Conflict',
      message: 'Execution flowRef does not match the approved agent action proposal.',
    };
  }

  const approvedPayload = proposal.parameters ?? {};
  const requestedPayload = input.payload ?? {};
  if (stableJson(approvedPayload) !== stableJson(requestedPayload)) {
    return {
      kind: 'Conflict',
      message: 'Execution payload does not match the approved agent action proposal.',
    };
  }

  return null;
}

function normalizeCachedOutput(value: unknown): ExecuteApprovedAgentActionOutput | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const status = record['status'];
  if (status !== 'Executing' && status !== 'Executed' && status !== 'Failed') return null;
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

function buildInProgressOutput(
  approvalId: ApprovalIdType,
  executionId: string,
): ExecuteApprovedAgentActionOutput {
  return {
    executionId,
    approvalId,
    status: 'Executing',
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

function normalizeExistingReservation(value: unknown): ExistingExecutionReservation {
  if (value === null) return { status: 'None' };
  if (typeof value !== 'object' || value === null) return { status: 'Conflict' };
  const record = value as Record<string, unknown>;
  const fingerprint = typeof record['fingerprint'] === 'string' ? record['fingerprint'] : undefined;

  if (record['status'] === 'InProgress') {
    return {
      status: 'InProgress',
      fingerprint: fingerprint ?? '',
      ...(typeof record['leaseExpiresAtIso'] === 'string'
        ? { leaseExpiresAtIso: record['leaseExpiresAtIso'] }
        : {}),
    };
  }

  if (record['status'] === 'Completed') {
    const output = normalizeCachedOutput(record['value']);
    if (!output) return { status: 'Conflict', ...(fingerprint ? { fingerprint } : {}) };
    return {
      status: 'Completed',
      fingerprint: fingerprint ?? '',
      output,
    };
  }

  const envelope = normalizeCachedEnvelope(value);
  if (envelope) {
    return {
      status: 'Completed',
      fingerprint: envelope.fingerprint,
      output: envelope.output,
    };
  }

  const output = normalizeCachedOutput(value);
  if (output) {
    return { status: 'Completed', fingerprint: fingerprint ?? '', output };
  }

  return { status: 'Conflict', ...(fingerprint ? { fingerprint } : {}) };
}

function addMillisecondsIso(baseIso: string, milliseconds: number): string | undefined {
  const epochMs = Date.parse(baseIso);
  if (!Number.isFinite(epochMs)) return undefined;
  return new Date(epochMs + milliseconds).toISOString();
}

async function readExistingReservation(
  deps: ExecuteApprovedAgentActionDeps,
  commandKey: Parameters<IdempotencyStore['get']>[0],
): Promise<ExistingExecutionReservation> {
  if (!deps.idempotency) return { status: 'None' };
  return normalizeExistingReservation(await deps.idempotency.get<unknown>(commandKey));
}

async function beginExecutionReservation(
  deps: ExecuteApprovedAgentActionDeps,
  commandKey: Parameters<IdempotencyStore['get']>[0],
  fingerprint: string,
  reservedAtIso: string,
): Promise<ExistingExecutionReservation | { status: 'Began' }> {
  const leaseExpiresAtIso = addMillisecondsIso(reservedAtIso, EXECUTION_RESERVATION_LEASE_MS);
  if (!deps.idempotency?.begin) {
    return { status: 'Began' };
  }

  const result = await deps.idempotency.begin(commandKey, {
    fingerprint,
    reservedAtIso,
    ...(leaseExpiresAtIso ? { leaseExpiresAtIso } : {}),
  });

  if (result.status === 'Began') return result;
  if (result.status === 'Completed') {
    const output = normalizeCachedOutput(result.value);
    if (!output) return { status: 'Conflict', fingerprint: result.fingerprint };
    return {
      status: 'Completed',
      fingerprint: result.fingerprint,
      output,
    };
  }
  return result;
}

async function completeExecutionReservation(
  deps: ExecuteApprovedAgentActionDeps,
  commandKey: Parameters<IdempotencyStore['get']>[0],
  fingerprint: string,
  completedAtIso: string,
  output: ExecuteApprovedAgentActionOutput,
): Promise<void> {
  if (!deps.idempotency) return;
  if (deps.idempotency.complete) {
    const completed = await deps.idempotency.complete(commandKey, {
      fingerprint,
      completedAtIso,
      value: output,
    });
    if (!completed) {
      throw new Error('Approved action execution reservation was lost before completion.');
    }
    return;
  }

  await deps.idempotency.set(commandKey, {
    fingerprint,
    output,
  });
}

async function releaseExecutionReservation(
  deps: ExecuteApprovedAgentActionDeps,
  commandKey: Parameters<IdempotencyStore['get']>[0],
  fingerprint: string,
  releasedAtIso: string,
  reason: string,
): Promise<void> {
  if (deps.idempotency?.release) {
    await deps.idempotency.release(commandKey, {
      fingerprint,
      releasedAtIso,
      reason,
    });
  }
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

  const proposalBoundApproval = String(approval.runId) === String(approval.planId);
  const proposal = deps.proposalStore
    ? await deps.proposalStore.getProposalByApprovalId(ctx.tenantId, approvalId)
    : null;
  if (proposal) {
    const proposalBindingError = validateApprovedProposalBinding(approval, proposal, input);
    if (proposalBindingError) {
      return err(proposalBindingError);
    }
  } else if (proposalBoundApproval) {
    if (!deps.proposalStore) {
      return err({
        kind: 'DependencyFailure',
        message: 'Agent action proposal store is required to execute proposal-bound approvals.',
      });
    }
    return err({
      kind: 'NotFound',
      resource: 'AgentActionProposal',
      message: `No stored agent action proposal is linked to approval ${input.approvalId}.`,
    });
  }

  const approvedFlowRef = proposal ? approvedProposalFlowRef(proposal) : input.flowRef;
  const approvedPayload = proposal ? (proposal.parameters ?? {}) : (input.payload ?? {});

  const providedIdempotencyKey = input.idempotencyKey?.trim();
  const dispatchIdempotencyKey =
    providedIdempotencyKey !== undefined && providedIdempotencyKey !== ''
      ? providedIdempotencyKey
      : `${EXECUTE_COMMAND}:${String(ctx.tenantId)}:${String(workspaceId)}:${String(approvalId)}:${approvedFlowRef}`;

  const commandKey = {
    tenantId: ctx.tenantId,
    commandName: EXECUTE_COMMAND,
    requestKey: dispatchIdempotencyKey,
  };
  const idempotencyFingerprint = stableJson({
    workspaceId: input.workspaceId,
    approvalId: input.approvalId,
    flowRef: approvedFlowRef,
    payload: approvedPayload,
    principalId: String(ctx.principalId),
  });

  const existingReservation = await readExistingReservation(deps, commandKey);
  if (existingReservation.status === 'Completed') {
    if (
      existingReservation.fingerprint !== '' &&
      existingReservation.fingerprint !== idempotencyFingerprint
    ) {
      return err({
        kind: 'Conflict',
        message:
          'Idempotency-Key was already used for a different approved action execution request.',
      });
    }
    return ok({ ...existingReservation.output, replayed: true });
  }
  if (existingReservation.status === 'InProgress') {
    if (existingReservation.fingerprint !== idempotencyFingerprint) {
      return err({
        kind: 'Conflict',
        message:
          'Idempotency-Key is already reserved for a different approved action execution request.',
      });
    }
    return ok(buildInProgressOutput(approvalId, dispatchIdempotencyKey));
  }
  if (existingReservation.status === 'Conflict') {
    return err({
      kind: 'Conflict',
      message: 'Idempotency-Key is already used by an incompatible execution record.',
    });
  }

  if (approval.status !== 'Approved') {
    if (approval.status === 'Executing') {
      return ok(buildInProgressOutput(approvalId, dispatchIdempotencyKey));
    }
    return err({
      kind: 'Conflict',
      message: `Approval ${input.approvalId} is not in Approved status (current: ${approval.status}).`,
    });
  }

  if (!deps.actionRunner) {
    return err({
      kind: 'DependencyFailure',
      message: 'Action runner is not configured for approved action execution.',
    });
  }

  // Stable across retries so execution-plane dedupe can key on both actionId and Idempotency-Key.
  const executionId = dispatchIdempotencyKey;
  const executedAtIso = deps.clock.nowIso();
  if (executedAtIso.trim() === '') {
    return err({ kind: 'DependencyFailure', message: 'Clock returned an invalid timestamp.' });
  }

  const begunReservation = await beginExecutionReservation(
    deps,
    commandKey,
    idempotencyFingerprint,
    executedAtIso,
  );
  if (begunReservation.status === 'Completed') {
    if (
      begunReservation.fingerprint !== '' &&
      begunReservation.fingerprint !== idempotencyFingerprint
    ) {
      return err({
        kind: 'Conflict',
        message:
          'Idempotency-Key was already used for a different approved action execution request.',
      });
    }
    return ok({ ...begunReservation.output, replayed: true });
  }
  if (begunReservation.status === 'InProgress') {
    if (begunReservation.fingerprint !== idempotencyFingerprint) {
      return err({
        kind: 'Conflict',
        message:
          'Idempotency-Key is already reserved for a different approved action execution request.',
      });
    }
    return ok(buildInProgressOutput(approvalId, dispatchIdempotencyKey));
  }
  if (begunReservation.status === 'Conflict') {
    return err({
      kind: 'Conflict',
      message: 'Idempotency-Key is already used by an incompatible execution record.',
    });
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
      await releaseExecutionReservation(
        deps,
        commandKey,
        idempotencyFingerprint,
        executedAtIso,
        'approval-claim-lost',
      );
      return err({
        kind: 'Conflict',
        message: `Approval ${input.approvalId} is already being executed or is no longer Approved.`,
      });
    }
  } catch (error) {
    await releaseExecutionReservation(
      deps,
      commandKey,
      idempotencyFingerprint,
      executedAtIso,
      'approval-claim-failed',
    );
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
    flowRef: approvedFlowRef,
    payload: approvedPayload,
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
      await completeExecutionReservation(
        deps,
        commandKey,
        idempotencyFingerprint,
        executedAtIso,
        output,
      );
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
