/**
 * Sweep Escalation Approvals Command (bead-0910).
 *
 * Evaluates pending approvals with escalation chains and creates
 * assignment audit trail entries when new escalation steps are reached.
 *
 * Unlike `sweep-expired-approvals`, this command does NOT change the
 * approval status. It only creates audit evidence entries for escalation
 * step transitions, serving as a notification and record-keeping mechanism.
 */

import {
  EvidenceId,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
  type CorrelationId as CorrelationIdType,
} from '../../domain/primitives/index.js';
import type { ApprovalPendingV1 } from '../../domain/approvals/index.js';
import {
  evaluateEscalation,
  type EscalationEvaluationV1,
} from '../../domain/approvals/approval-escalation-v1.js';
import type { ApprovalQueryStore } from '../ports/approval-store.js';
import type { Clock, IdGenerator } from '../ports/index.js';
import type { EvidenceLogPort } from '../ports/evidence-log.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SweepEscalationInput = Readonly<{
  workspaceId: string;
  correlationId: string;
}>;

export type EscalationAuditEntry = Readonly<{
  approvalId: ApprovalIdType;
  stepIndex: number;
  escalateToUserId: string;
  elapsedHours: number;
}>;

export type SweepEscalationOutput = Readonly<{
  evaluated: number;
  escalationsRecorded: number;
  entries: readonly EscalationAuditEntry[];
}>;

export interface SweepEscalationDeps {
  approvalQueryStore: ApprovalQueryStore;
  clock: Clock;
  idGenerator: IdGenerator;
  evidenceLog?: EvidenceLogPort;
  /**
   * Optional injected escalation audit state map. When provided, the command
   * uses this map instead of the module-level default. This avoids shared
   * mutable state across independent scheduler instances.
   */
  escalationAuditState?: Map<string, number>;
}

// ---------------------------------------------------------------------------
// State tracking (avoids re-auditing the same escalation step)
// ---------------------------------------------------------------------------

/**
 * Default in-memory map of workspaceId:approvalId -> last audited escalation
 * step index. Used as a fallback when no escalation audit state map is
 * injected via `deps.escalationAuditState`.
 */
const defaultAuditState = new Map<string, number>();

/**
 * Reset tracked state -- useful for testing.
 * Clears both the default module-level map and, optionally, a caller-provided map.
 */
export function resetEscalationAuditState(injectedState?: Map<string, number>): void {
  defaultAuditState.clear();
  if (injectedState) injectedState.clear();
}

/** Return the number of tracked entries -- useful for testing cleanup. */
export function getEscalationAuditStateSize(injectedState?: Map<string, number>): number {
  return (injectedState ?? defaultAuditState).size;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export async function sweepEscalationApprovals(
  deps: SweepEscalationDeps,
  input: SweepEscalationInput,
): Promise<SweepEscalationOutput> {
  const workspaceId = input.workspaceId as WorkspaceIdType;
  const correlationId = input.correlationId as CorrelationIdType;
  const nowIso = deps.clock.nowIso();
  const stateMap = deps.escalationAuditState ?? defaultAuditState;

  const page = await deps.approvalQueryStore.listApprovals(workspaceId, workspaceId, {
    status: 'Pending',
    limit: 500,
  });

  const pendingApprovals = page.items.filter((a): a is ApprovalPendingV1 => a.status === 'Pending');

  const entries: EscalationAuditEntry[] = [];

  for (const approval of pendingApprovals) {
    if (!approval.escalationChain || approval.escalationChain.length === 0) {
      continue;
    }

    const evaluation = evaluateEscalation(
      approval.escalationChain,
      approval.requestedAtIso,
      nowIso,
    );

    const newEntries = await evaluateAndAudit(
      deps,
      approval,
      evaluation,
      workspaceId,
      correlationId,
      nowIso,
      stateMap,
    );
    entries.push(...newEntries);
  }

  // Prune state map entries for approvals no longer pending (resolved by
  // human decision or other means). This prevents unbounded memory growth.
  const pendingKeys = new Set(
    pendingApprovals.map((a) => `${String(workspaceId)}:${String(a.approvalId)}`),
  );
  const wsPrefix = `${String(workspaceId)}:`;
  for (const key of stateMap.keys()) {
    if (key.startsWith(wsPrefix) && !pendingKeys.has(key)) {
      stateMap.delete(key);
    }
  }

  return {
    evaluated: pendingApprovals.length,
    escalationsRecorded: entries.length,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Per-approval evaluation
// ---------------------------------------------------------------------------

async function evaluateAndAudit(
  deps: SweepEscalationDeps,
  approval: ApprovalPendingV1,
  evaluation: EscalationEvaluationV1,
  workspaceId: WorkspaceIdType,
  correlationId: CorrelationIdType,
  nowIso: string,
  stateMap: Map<string, number>,
): Promise<EscalationAuditEntry[]> {
  if (!evaluation.isEscalated) return [];

  const approvalKey = `${String(workspaceId)}:${String(approval.approvalId)}`;
  const lastAudited = stateMap.get(approvalKey) ?? -1;

  if (evaluation.activeStepIndex <= lastAudited) return [];

  const entry: EscalationAuditEntry = {
    approvalId: approval.approvalId,
    stepIndex: evaluation.activeStepIndex,
    escalateToUserId: evaluation.activeStep!.escalateToUserId,
    elapsedHours: evaluation.elapsedHours,
  };

  // Record evidence audit trail
  if (deps.evidenceLog) {
    const evidenceId = EvidenceId(deps.idGenerator.generateId());
    await deps.evidenceLog.appendEntry(workspaceId, {
      schemaVersion: 1,
      evidenceId,
      workspaceId,
      correlationId,
      occurredAtIso: nowIso,
      category: 'Approval',
      summary: `Escalation: approval ${String(approval.approvalId)} escalated to step ${String(evaluation.activeStepIndex + 1)}, assigned to ${evaluation.activeStep!.escalateToUserId} (${String(Math.round(evaluation.elapsedHours * 10) / 10)}h elapsed)`,
      actor: { kind: 'System' },
      links: { approvalId: approval.approvalId },
    });
  }

  stateMap.set(approvalKey, evaluation.activeStepIndex);

  return [entry];
}
