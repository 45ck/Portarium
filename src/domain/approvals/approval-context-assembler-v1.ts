/**
 * Approval Context Assembler (bead-0815).
 *
 * Assembles a complete approval decision surface from the individual
 * domain modules. This is the top-level "view model" that ties together:
 *
 *   - Lifecycle status (approval-lifecycle-v1)
 *   - Snapshot binding verification (approval-snapshot-binding-v1)
 *   - Policy evaluation results (approval-policy-rules-v1)
 *   - Decision record (approval-decision-record-v1)
 *   - Delegation grants (approval-delegation-v1)
 *   - Escalation status (approval-escalation-v1)
 *
 * The assembled context tells the approver everything they need to know
 * to make an informed decision, and provides readiness checks.
 *
 * This is a domain service — no side effects, no external deps.
 */

import type { ApprovalId as ApprovalIdType, UserId as UserIdType } from '../primitives/index.js';

import type { ApprovalLifecycleStatus } from './approval-lifecycle-v1.js';
import type { SnapshotVerificationResultV1 } from './approval-snapshot-binding-v1.js';
import type { PolicySetEvaluationV1 } from './approval-policy-rules-v1.js';
import type { ApprovalDecisionRecordV1 } from './approval-decision-record-v1.js';
import type { ApprovalDelegationGrantV1 } from './approval-delegation-v1.js';
import type { EscalationEvaluationV1 } from './approval-escalation-v1.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Readiness flags for an approval decision. */
export type ApprovalReadinessV1 = Readonly<{
  /** Whether the approval is in a state where a decision can be made. */
  canDecide: boolean;
  /** Whether the content snapshot has been verified (no drift). */
  snapshotVerified: boolean;
  /** Whether all policies pass (no Fail outcomes). */
  policiesPass: boolean;
  /** Whether any policy needs human review. */
  policiesNeedHuman: boolean;
  /** Whether the approval has expired. */
  isExpired: boolean;
  /** Whether the approval is escalated. */
  isEscalated: boolean;
  /** Blocking reasons preventing a decision (empty if canDecide is true). */
  blockingReasons: readonly string[];
}>;

/**
 * The full assembled approval context — everything an approver needs
 * to make an informed decision.
 */
export type ApprovalContextV1 = Readonly<{
  /** The approval being decided. */
  approvalId: ApprovalIdType;
  /** Current lifecycle status. */
  lifecycleStatus: ApprovalLifecycleStatus;
  /** Readiness assessment. */
  readiness: ApprovalReadinessV1;
  /** Snapshot verification result (if verified). */
  snapshotVerification: SnapshotVerificationResultV1 | null;
  /** Policy evaluation result (if evaluated). */
  policyEvaluation: PolicySetEvaluationV1 | null;
  /** Existing decision record (if decided). */
  decisionRecord: ApprovalDecisionRecordV1 | null;
  /** Applicable delegation grants for the current user. */
  applicableDelegations: readonly ApprovalDelegationGrantV1[];
  /** Escalation evaluation (if escalation chain exists). */
  escalationEvaluation: EscalationEvaluationV1 | null;
  /** ISO-8601 timestamp when the context was assembled. */
  assembledAtIso: string;
}>;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Input for assembling an approval context. */
export interface AssembleApprovalContextInput {
  approvalId: ApprovalIdType;
  lifecycleStatus: ApprovalLifecycleStatus;
  snapshotVerification?: SnapshotVerificationResultV1;
  policyEvaluation?: PolicySetEvaluationV1;
  decisionRecord?: ApprovalDecisionRecordV1;
  applicableDelegations?: readonly ApprovalDelegationGrantV1[];
  escalationEvaluation?: EscalationEvaluationV1;
  assembledAtIso: string;
}

// ---------------------------------------------------------------------------
// Assembler
// ---------------------------------------------------------------------------

/** Active lifecycle statuses where a decision can be made. */
const DECIDABLE_STATUSES = new Set<ApprovalLifecycleStatus>(['Open', 'Assigned', 'UnderReview']);

/**
 * Assemble a complete approval context from individual domain pieces.
 *
 * Computes readiness flags and blocking reasons based on the assembled state.
 */
export function assembleApprovalContext(input: AssembleApprovalContextInput): ApprovalContextV1 {
  const snapshotVerification = input.snapshotVerification ?? null;
  const policyEvaluation = input.policyEvaluation ?? null;
  const decisionRecord = input.decisionRecord ?? null;
  const applicableDelegations = input.applicableDelegations ?? [];
  const escalationEvaluation = input.escalationEvaluation ?? null;

  const readiness = computeReadiness({
    lifecycleStatus: input.lifecycleStatus,
    snapshotVerification,
    policyEvaluation,
    escalationEvaluation,
  });

  return Object.freeze({
    approvalId: input.approvalId,
    lifecycleStatus: input.lifecycleStatus,
    readiness,
    snapshotVerification,
    policyEvaluation,
    decisionRecord,
    applicableDelegations: Object.freeze([...applicableDelegations]),
    escalationEvaluation,
    assembledAtIso: input.assembledAtIso,
  });
}

// ---------------------------------------------------------------------------
// Readiness computation
// ---------------------------------------------------------------------------

function computeReadiness(params: {
  lifecycleStatus: ApprovalLifecycleStatus;
  snapshotVerification: SnapshotVerificationResultV1 | null;
  policyEvaluation: PolicySetEvaluationV1 | null;
  escalationEvaluation: EscalationEvaluationV1 | null;
}): ApprovalReadinessV1 {
  const blockingReasons: string[] = [];

  // Check lifecycle status
  const inDecidableStatus = DECIDABLE_STATUSES.has(params.lifecycleStatus);
  if (!inDecidableStatus) {
    blockingReasons.push(`Lifecycle status "${params.lifecycleStatus}" does not allow decisions.`);
  }

  // Check snapshot verification
  const snapshotVerified =
    params.snapshotVerification !== null && params.snapshotVerification.status === 'verified';
  if (params.snapshotVerification !== null && params.snapshotVerification.status === 'drifted') {
    blockingReasons.push('Content has drifted since the snapshot was captured.');
  }

  // Check policy evaluation
  const policiesPass =
    params.policyEvaluation !== null && params.policyEvaluation.aggregateOutcome === 'Pass';
  const policiesNeedHuman =
    params.policyEvaluation !== null && params.policyEvaluation.aggregateOutcome === 'NeedsHuman';
  const policiesFail =
    params.policyEvaluation !== null && params.policyEvaluation.aggregateOutcome === 'Fail';
  if (policiesFail) {
    blockingReasons.push('One or more policies have failed.');
  }

  // Check expiry via lifecycle status
  const isExpired = params.lifecycleStatus === 'Expired';
  if (isExpired) {
    blockingReasons.push('Approval has expired.');
  }

  // Check escalation
  const isEscalated = params.escalationEvaluation?.isEscalated ?? false;

  // Overall decision: can decide if in decidable status and no hard blockers
  const canDecide = inDecidableStatus && !policiesFail && !isExpired;

  return Object.freeze({
    canDecide,
    snapshotVerified,
    policiesPass,
    policiesNeedHuman,
    isExpired,
    isEscalated,
    blockingReasons: Object.freeze(blockingReasons),
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check whether the approval context has a decision record.
 */
export function isDecided(context: ApprovalContextV1): boolean {
  return context.decisionRecord !== null;
}

/**
 * Check whether the approval is delegated (has applicable delegation grants).
 */
export function hasDelegation(context: ApprovalContextV1): boolean {
  return context.applicableDelegations.length > 0;
}

/**
 * Get the delegators (users who delegated authority) for applicable grants.
 */
export function getDelegators(context: ApprovalContextV1): readonly UserIdType[] {
  return context.applicableDelegations.map((g) => g.delegatorUserId);
}

/**
 * Produce a human-readable summary of the approval context.
 */
export function summarizeApprovalContext(context: ApprovalContextV1): string {
  const parts: string[] = [
    `Approval: ${context.approvalId}`,
    `Status: ${context.lifecycleStatus}`,
    `Can decide: ${String(context.readiness.canDecide)}`,
  ];

  if (context.readiness.snapshotVerified) {
    parts.push('Snapshot: verified');
  } else if (context.snapshotVerification?.status === 'drifted') {
    parts.push('Snapshot: DRIFTED');
  }

  if (context.policyEvaluation) {
    parts.push(`Policies: ${context.policyEvaluation.aggregateOutcome}`);
  }

  if (context.readiness.isEscalated) {
    parts.push('Escalated: yes');
  }

  if (context.applicableDelegations.length > 0) {
    parts.push(`Delegations: ${String(context.applicableDelegations.length)}`);
  }

  if (context.readiness.blockingReasons.length > 0) {
    parts.push(`Blocked: ${String(context.readiness.blockingReasons.length)} reason(s)`);
  }

  if (context.decisionRecord) {
    parts.push(`Decision: ${context.decisionRecord.decision}`);
  }

  return parts.join(' | ');
}
