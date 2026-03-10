/**
 * Sweep Expired Approvals Command (bead-0910).
 *
 * Orchestrates the full expiry workflow:
 *  1. Evaluates pending approvals via the scheduler evaluation engine
 *  2. Transitions expired approvals to 'Expired' status in the store
 *  3. Publishes ApprovalExpired CloudEvents
 *  4. Creates tamper-evident audit evidence entries
 *
 * This is the application-layer command that turns scheduler evaluations
 * into persisted state changes. The domain evaluation logic lives in
 * `src/application/services/approval-expiry-scheduler.ts`.
 */

import {
  EvidenceId,
  UserId,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
  type CorrelationId as CorrelationIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalDecidedV1 } from '../../domain/approvals/index.js';
import type { ApprovalExpiredPayload } from '../../domain/approvals/approval-escalation-events-v1.js';
import { domainEventToPortariumCloudEvent } from '../events/cloudevent.js';
import {
  evaluatePendingApprovals,
  type ApprovalExpirySchedulerDeps,
  type SchedulerAction,
  type SchedulerContext,
} from '../services/approval-expiry-scheduler.js';
import type { ApprovalStore, Clock, EventPublisher, IdGenerator } from '../ports/index.js';
import type { EvidenceLogPort } from '../ports/evidence-log.js';
import type { ApprovalQueryStore } from '../ports/approval-store.js';

const SWEEP_SOURCE = 'portarium.scheduler.approval-expiry';
const SYSTEM_ACTOR_ID = 'system:scheduler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SweepExpiredApprovalsInput = Readonly<{
  workspaceId: string;
  correlationId: string;
}>;

export type SweepExpiredApprovalsOutput = Readonly<{
  evaluated: number;
  expiredCount: number;
  escalatedCount: number;
}>;

export interface SweepExpiredApprovalsDeps {
  approvalStore: ApprovalStore;
  approvalQueryStore: ApprovalQueryStore;
  clock: Clock;
  idGenerator: IdGenerator;
  eventPublisher: EventPublisher;
  evidenceLog?: EvidenceLogPort;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function sweepExpiredApprovals(
  deps: SweepExpiredApprovalsDeps,
  input: SweepExpiredApprovalsInput,
): Promise<SweepExpiredApprovalsOutput> {
  const workspaceId = input.workspaceId as WorkspaceIdType;
  const correlationId = input.correlationId as CorrelationIdType;

  const schedulerDeps: ApprovalExpirySchedulerDeps = {
    approvalQueryStore: deps.approvalQueryStore,
    clock: deps.clock,
    idGenerator: deps.idGenerator,
  };

  const ctx: SchedulerContext = {
    tenantId: workspaceId,
    workspaceId,
    correlationId,
  };

  // Evaluate all pending approvals
  const result = await evaluatePendingApprovals(schedulerDeps, ctx);

  let expiredCount = 0;
  let escalatedCount = 0;

  // Process each action
  for (const action of result.actions) {
    if (action.kind === 'expired') {
      await processExpiredAction(deps, action, workspaceId, correlationId);
      expiredCount++;
    } else if (action.kind === 'escalated') {
      await processEscalatedAction(deps, action, workspaceId, correlationId);
      escalatedCount++;
    }
  }

  return {
    evaluated: result.evaluated,
    expiredCount,
    escalatedCount,
  };
}

// ---------------------------------------------------------------------------
// Expired action processing
// ---------------------------------------------------------------------------

async function processExpiredAction(
  deps: SweepExpiredApprovalsDeps,
  action: SchedulerAction,
  workspaceId: WorkspaceIdType,
  correlationId: CorrelationIdType,
): Promise<void> {
  const payload = action.event.payload as ApprovalExpiredPayload;
  const approvalId = payload.approvalId;

  // Load the current approval
  const existing = await deps.approvalStore.getApprovalById(workspaceId, workspaceId, approvalId);

  if (existing?.status === 'Pending') {
    // Transition to expired by saving a decided record with 'Denied' status
    // representing the system-level expiry. We use the ApprovalDecidedV1 shape
    // with a system actor and expiry rationale.
    const expired: ApprovalDecidedV1 = {
      ...existing,
      status: 'Denied',
      decidedAtIso: payload.expiredAtIso,
      decidedByUserId: UserId(SYSTEM_ACTOR_ID),
      rationale: payload.reason,
    };

    await deps.approvalStore.saveApproval(workspaceId, expired);
  }

  // Publish CloudEvent
  const cloudEvent = domainEventToPortariumCloudEvent(action.event, SWEEP_SOURCE);
  await deps.eventPublisher.publish(cloudEvent);

  // Record audit evidence
  if (deps.evidenceLog) {
    const evidenceId = EvidenceId(deps.idGenerator.generateId());
    await deps.evidenceLog.appendEntry(workspaceId, {
      schemaVersion: 1,
      evidenceId,
      workspaceId,
      correlationId,
      occurredAtIso: payload.expiredAtIso,
      category: 'System',
      summary: `Approval ${String(approvalId)} expired: ${payload.reason}`,
      actor: { kind: 'System' },
      links: { approvalId },
    });
  }
}

// ---------------------------------------------------------------------------
// Escalated action processing
// ---------------------------------------------------------------------------

async function processEscalatedAction(
  deps: SweepExpiredApprovalsDeps,
  action: SchedulerAction,
  workspaceId: WorkspaceIdType,
  correlationId: CorrelationIdType,
): Promise<void> {
  // Publish CloudEvent for escalation
  const cloudEvent = domainEventToPortariumCloudEvent(action.event, SWEEP_SOURCE);
  await deps.eventPublisher.publish(cloudEvent);

  // Record audit evidence for the escalation
  if (deps.evidenceLog) {
    const payload = action.event.payload as {
      approvalId: ApprovalIdType;
      stepIndex: number;
      escalateToUserId: string;
      elapsedHours: number;
    };

    const evidenceId = EvidenceId(deps.idGenerator.generateId());
    await deps.evidenceLog.appendEntry(workspaceId, {
      schemaVersion: 1,
      evidenceId,
      workspaceId,
      correlationId,
      occurredAtIso: action.event.occurredAtIso,
      category: 'Approval',
      summary: `Approval ${String(payload.approvalId)} escalated to step ${String(payload.stepIndex + 1)}, target: ${payload.escalateToUserId} (${String(Math.round(payload.elapsedHours * 10) / 10)}h elapsed)`,
      actor: { kind: 'System' },
      links: { approvalId: payload.approvalId },
    });
  }
}
