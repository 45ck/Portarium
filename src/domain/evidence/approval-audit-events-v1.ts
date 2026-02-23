/**
 * Approval audit event definitions (bead-y5ob).
 *
 * Defines the typed event catalog for the evidence-first approval audit trail.
 * Every approval lifecycle interaction produces a structured audit event that
 * maps directly to an `EvidenceEntryV1`. These events ensure "what did the
 * human actually see and decide?" is always answerable.
 *
 * Event categories:
 *   - `approval_opened`       : Request created with immutable payload hash
 *   - `policy_evaluated`      : Policy engine results captured at request time
 *   - `approval_assigned`     : Approver assignment recorded
 *   - `decision_recorded`     : Human/system decision with rationale
 *   - `changes_requested`     : Request for changes with actionable feedback
 *   - `approval_reopened`     : Re-opened after changes were addressed
 *   - `approval_executed`     : Post-approval execution triggered
 *   - `effects_applied`       : External effects observed after execution
 *   - `rollback_executed`     : Rollback performed after execution
 *   - `approval_expired`      : SLA timeout reached before decision
 *
 * Each event produces an `EvidenceEntryV1` via `buildApprovalAuditEntry()`.
 * The evidence chain ensures tamper-detection across the approval lifecycle.
 */

import type {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  PolicyId,
  RunId,
  UserId,
  WorkspaceId,
} from '../primitives/index.js';
import type { EvidenceActor, EvidenceCategory, EvidenceEntryV1 } from './evidence-entry-v1.js';
import type { EvidenceHasher } from './evidence-hasher.js';
import { appendEvidenceEntryV1 } from './evidence-chain-v1.js';

// ---------------------------------------------------------------------------
// Audit event kind
// ---------------------------------------------------------------------------

export type ApprovalAuditEventKind =
  | 'approval_opened'
  | 'policy_evaluated'
  | 'approval_assigned'
  | 'decision_recorded'
  | 'changes_requested'
  | 'approval_reopened'
  | 'approval_executed'
  | 'effects_applied'
  | 'rollback_executed'
  | 'approval_expired';

// ---------------------------------------------------------------------------
// Event detail types
// ---------------------------------------------------------------------------

export type ApprovalOpenedDetail = Readonly<{
  kind: 'approval_opened';
  approvalId: ApprovalId;
  requestedByUserId: UserId;
  payloadHash: HashSha256;
  prompt: string;
}>;

export type PolicyEvaluatedDetail = Readonly<{
  kind: 'policy_evaluated';
  approvalId: ApprovalId;
  policyId: PolicyId;
  outcome: 'pass' | 'fail' | 'needs_human';
  explanation: string;
}>;

export type ApprovalAssignedDetail = Readonly<{
  kind: 'approval_assigned';
  approvalId: ApprovalId;
  assigneeUserId: UserId;
  reason: string;
}>;

export type DecisionRecordedDetail = Readonly<{
  kind: 'decision_recorded';
  approvalId: ApprovalId;
  decision: 'Approved' | 'Denied';
  decidedByUserId: UserId;
  rationale: string;
  payloadHashAtDecision: HashSha256;
}>;

export type ChangesRequestedDetail = Readonly<{
  kind: 'changes_requested';
  approvalId: ApprovalId;
  requestedByUserId: UserId;
  feedback: string;
}>;

export type ApprovalReopenedDetail = Readonly<{
  kind: 'approval_reopened';
  approvalId: ApprovalId;
  reopenedByUserId: UserId;
  reason: string;
}>;

export type ApprovalExecutedDetail = Readonly<{
  kind: 'approval_executed';
  approvalId: ApprovalId;
  runId: RunId;
}>;

export type EffectsAppliedDetail = Readonly<{
  kind: 'effects_applied';
  approvalId: ApprovalId;
  runId: RunId;
  effectCount: number;
  effectsSummary: string;
}>;

export type RollbackExecutedDetail = Readonly<{
  kind: 'rollback_executed';
  approvalId: ApprovalId;
  runId: RunId;
  reason: string;
}>;

export type ApprovalExpiredDetail = Readonly<{
  kind: 'approval_expired';
  approvalId: ApprovalId;
  expiredAtIso: string;
}>;

/** Discriminated union of all approval audit event details. */
export type ApprovalAuditEventDetail =
  | ApprovalOpenedDetail
  | PolicyEvaluatedDetail
  | ApprovalAssignedDetail
  | DecisionRecordedDetail
  | ChangesRequestedDetail
  | ApprovalReopenedDetail
  | ApprovalExecutedDetail
  | EffectsAppliedDetail
  | RollbackExecutedDetail
  | ApprovalExpiredDetail;

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

const EVENT_CATEGORY: Record<ApprovalAuditEventKind, EvidenceCategory> = {
  approval_opened: 'Approval',
  policy_evaluated: 'Policy',
  approval_assigned: 'Approval',
  decision_recorded: 'Approval',
  changes_requested: 'Approval',
  approval_reopened: 'Approval',
  approval_executed: 'Action',
  effects_applied: 'Action',
  rollback_executed: 'Action',
  approval_expired: 'System',
};

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(detail: ApprovalAuditEventDetail): string {
  switch (detail.kind) {
    case 'approval_opened':
      return `Approval ${detail.approvalId} opened by ${detail.requestedByUserId}: ${detail.prompt}`;
    case 'policy_evaluated':
      return `Policy ${detail.policyId} evaluated for ${detail.approvalId}: ${detail.outcome} — ${detail.explanation}`;
    case 'approval_assigned':
      return `Approval ${detail.approvalId} assigned to ${detail.assigneeUserId}: ${detail.reason}`;
    case 'decision_recorded':
      return `Approval ${detail.approvalId} ${detail.decision} by ${detail.decidedByUserId}: ${detail.rationale}`;
    case 'changes_requested':
      return `Changes requested on ${detail.approvalId} by ${detail.requestedByUserId}: ${detail.feedback}`;
    case 'approval_reopened':
      return `Approval ${detail.approvalId} reopened by ${detail.reopenedByUserId}: ${detail.reason}`;
    case 'approval_executed':
      return `Approval ${detail.approvalId} executed via run ${detail.runId}`;
    case 'effects_applied':
      return `${detail.effectCount} effect(s) applied for ${detail.approvalId}: ${detail.effectsSummary}`;
    case 'rollback_executed':
      return `Rollback executed for ${detail.approvalId} (run ${detail.runId}): ${detail.reason}`;
    case 'approval_expired':
      return `Approval ${detail.approvalId} expired at ${detail.expiredAtIso}`;
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildApprovalAuditEntryParams {
  evidenceId: EvidenceId;
  workspaceId: WorkspaceId;
  correlationId: CorrelationId;
  occurredAtIso: string;
  actor: EvidenceActor;
  detail: ApprovalAuditEventDetail;
  previousEntry?: EvidenceEntryV1;
  hasher: EvidenceHasher;
}

/**
 * Build a typed evidence entry from an approval audit event.
 *
 * The entry is appended to the evidence chain (linked via `previousHash`)
 * and hashed for tamper-detection.
 */
export function buildApprovalAuditEntry(params: BuildApprovalAuditEntryParams): EvidenceEntryV1 {
  const {
    evidenceId,
    workspaceId,
    correlationId,
    occurredAtIso,
    actor,
    detail,
    previousEntry,
    hasher,
  } = params;

  return appendEvidenceEntryV1({
    previous: previousEntry,
    next: {
      schemaVersion: 1,
      evidenceId,
      workspaceId,
      correlationId,
      occurredAtIso,
      category: EVENT_CATEGORY[detail.kind],
      summary: buildSummary(detail),
      actor,
      links: { approvalId: detail.approvalId },
    },
    hasher,
  });
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

const VALID_KINDS = new Set<string>([
  'approval_opened',
  'policy_evaluated',
  'approval_assigned',
  'decision_recorded',
  'changes_requested',
  'approval_reopened',
  'approval_executed',
  'effects_applied',
  'rollback_executed',
  'approval_expired',
]);

export function isApprovalAuditEventKind(value: string): value is ApprovalAuditEventKind {
  return VALID_KINDS.has(value);
}
