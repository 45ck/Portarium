/**
 * Approval Expiry & Escalation Scheduler (bead-0910).
 *
 * Periodically evaluates all pending approvals with escalation chains.
 * Emits ApprovalEscalated events when a new escalation step is reached,
 * and ApprovalExpired events when the final deadline + grace period passes.
 */

import type {
  ApprovalId as ApprovalIdType,
  UserId as UserIdType,
  WorkspaceId as WorkspaceIdType,
  CorrelationId as CorrelationIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1 } from '../../domain/approvals/index.js';
import type { DomainEventV1 } from '../../domain/events/domain-events-v1.js';
import {
  evaluateEscalation,
  type EscalationEvaluationV1,
} from '../../domain/approvals/approval-escalation-v1.js';
import type {
  ApprovalEscalatedPayload,
  ApprovalExpiredPayload,
} from '../../domain/approvals/approval-escalation-events-v1.js';
import type { ApprovalQueryStore } from '../ports/approval-store.js';
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Hours after the final escalation step before the approval expires. */
export const EXPIRY_GRACE_HOURS = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An action the scheduler determined should be taken. */
export type SchedulerAction =
  | Readonly<{ kind: 'escalated'; event: DomainEventV1 }>
  | Readonly<{ kind: 'expired'; event: DomainEventV1 }>;

/** Result of one evaluation sweep. */
export type EvaluatePendingResult = Readonly<{
  evaluated: number;
  actions: readonly SchedulerAction[];
}>;

/** Dependencies for the scheduler evaluation function. */
export interface ApprovalExpirySchedulerDeps {
  approvalQueryStore: ApprovalQueryStore;
  clock: Clock;
  idGenerator: IdGenerator;
}

/** Minimal context needed for the scheduler (system actor). */
export type SchedulerContext = Readonly<{
  tenantId: WorkspaceIdType;
  workspaceId: WorkspaceIdType;
  correlationId: CorrelationIdType;
}>;

// ---------------------------------------------------------------------------
// State tracking (avoids re-emitting for the same escalation step)
// ---------------------------------------------------------------------------

/**
 * In-memory map of approvalId -> last observed escalation step index.
 * Prevents duplicate ApprovalEscalated events across sweeps.
 */
const lastStepByApproval = new Map<string, number>();

/** Reset tracked state — useful for testing. */
export function resetSchedulerState(): void {
  lastStepByApproval.clear();
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all pending approvals for a given tenant/workspace.
 * Returns the list of actions (escalation or expiry events) that should
 * be published.
 */
export async function evaluatePendingApprovals(
  deps: ApprovalExpirySchedulerDeps,
  ctx: SchedulerContext,
): Promise<EvaluatePendingResult> {
  const nowIso = deps.clock.nowIso();

  // Fetch all pending approvals (paginate if needed)
  const page = await deps.approvalQueryStore.listApprovals(ctx.tenantId, ctx.workspaceId, {
    status: 'Pending',
    limit: 500,
  });

  const pendingApprovals = page.items.filter(
    (a): a is ApprovalPendingV1 => a.status === 'Pending',
  );

  const actions: SchedulerAction[] = [];

  for (const approval of pendingApprovals) {
    if (!approval.escalationChain || approval.escalationChain.length === 0) {
      continue;
    }

    const evaluation = evaluateEscalation(
      approval.escalationChain,
      approval.requestedAtIso,
      nowIso,
    );

    const approvalActions = evaluateOneApproval(deps, ctx, approval, evaluation, nowIso);
    actions.push(...approvalActions);
  }

  return { evaluated: pendingApprovals.length, actions };
}

function evaluateOneApproval(
  deps: ApprovalExpirySchedulerDeps,
  ctx: SchedulerContext,
  approval: ApprovalPendingV1,
  evaluation: EscalationEvaluationV1,
  nowIso: string,
): SchedulerAction[] {
  const approvalKey = String(approval.approvalId);
  const lastStep = lastStepByApproval.get(approvalKey) ?? -1;
  const actions: SchedulerAction[] = [];

  // Check for expiry: fully escalated + grace period exceeded
  if (evaluation.fullyEscalated) {
    const finalStep = evaluation.sortedChain[evaluation.sortedChain.length - 1]!;
    const expiryThresholdHours = finalStep.afterHours + EXPIRY_GRACE_HOURS;

    if (evaluation.elapsedHours >= expiryThresholdHours) {
      const payload: ApprovalExpiredPayload = {
        approvalId: approval.approvalId,
        reason: `Approval exceeded final escalation deadline plus ${String(EXPIRY_GRACE_HOURS)}h grace period.`,
        expiredAtIso: nowIso,
      };
      actions.push({
        kind: 'expired',
        event: buildEvent(deps, ctx, approval.approvalId, 'ApprovalExpired', nowIso, payload),
      });
      // Clean up tracking state for expired approvals
      lastStepByApproval.delete(approvalKey);
      return actions;
    }
  }

  // Check for new escalation step
  if (evaluation.isEscalated && evaluation.activeStepIndex > lastStep) {
    const payload: ApprovalEscalatedPayload = {
      approvalId: approval.approvalId,
      stepIndex: evaluation.activeStepIndex,
      escalateToUserId: evaluation.activeStep!.escalateToUserId as UserIdType,
      elapsedHours: evaluation.elapsedHours,
    };
    actions.push({
      kind: 'escalated',
      event: buildEvent(deps, ctx, approval.approvalId, 'ApprovalEscalated', nowIso, payload),
    });
    lastStepByApproval.set(approvalKey, evaluation.activeStepIndex);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEvent(
  deps: ApprovalExpirySchedulerDeps,
  ctx: SchedulerContext,
  approvalId: ApprovalIdType,
  eventType: 'ApprovalEscalated' | 'ApprovalExpired',
  occurredAtIso: string,
  payload: ApprovalEscalatedPayload | ApprovalExpiredPayload,
): DomainEventV1 {
  return {
    schemaVersion: 1,
    eventId: deps.idGenerator.generateId(),
    eventType,
    aggregateKind: 'Approval',
    aggregateId: approvalId,
    occurredAtIso,
    workspaceId: ctx.workspaceId,
    correlationId: ctx.correlationId,
    payload,
  };
}
