/**
 * Approval Decision Record (bead-0809).
 *
 * A structured, immutable record of an approval decision that captures
 * not just the outcome but the full context: who decided, why, what
 * policy evaluation informed the decision, what evidence was considered,
 * and whether AI assistance was involved.
 *
 * Part of bead-d5ta (Approval Workflows — Universal Decision Surface):
 * "decision capture" component of the approval shell.
 *
 * This is a domain value object — no side effects, no external deps.
 * The record is deep-frozen after construction.
 */

import type {
  ApprovalDecision,
  ApprovalId as ApprovalIdType,
  HashSha256 as HashSha256Type,
  UserId as UserIdType,
  WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How the decision was made. */
export type DecisionMethod = 'manual' | 'ai_assisted' | 'auto_approved' | 'delegation';

/** Risk level assessed for the decision. */
export type DecisionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** A reference to a policy evaluation that informed the decision. */
export type PolicyEvaluationRefV1 = Readonly<{
  /** The policy ID that was evaluated. */
  policyId: string;
  /** The outcome of the evaluation. */
  outcome: 'Pass' | 'Fail' | 'NeedsHuman';
  /** Number of trace entries produced. */
  traceEntryCount: number;
}>;

/** A reference to evidence considered during the decision. */
export type EvidenceRefV1 = Readonly<{
  /** Evidence entry ID. */
  evidenceId: string;
  /** Human-readable summary of the evidence. */
  summary: string;
  /** Whether this evidence was decisive in the outcome. */
  decisive: boolean;
}>;

/** AI assistance context, if the decision was AI-assisted. */
export type AiAssistanceContextV1 = Readonly<{
  /** The AI model that provided the recommendation. */
  modelId: string;
  /** The AI's recommended decision. */
  recommendation: ApprovalDecision;
  /** Confidence score (0..1). */
  confidenceScore: number;
  /** Whether the human agreed with the AI recommendation. */
  humanAgreedWithAi: boolean;
  /** Optional: hash of the AI summary for audit trail linkage. */
  summaryHash?: HashSha256Type;
}>;

/**
 * The immutable decision record.
 *
 * Created when an approver (human or automated) makes a decision.
 * Captures the full context needed for audit, compliance, and
 * post-decision review.
 */
export type ApprovalDecisionRecordV1 = Readonly<{
  schemaVersion: 1;
  /** The approval this decision belongs to. */
  approvalId: ApprovalIdType;
  /** Workspace context. */
  workspaceId: WorkspaceIdType;
  /** The decision outcome. */
  decision: ApprovalDecision;
  /** How the decision was made. */
  method: DecisionMethod;
  /** Human-readable justification for the decision. */
  rationale: string;
  /** ISO-8601 timestamp when the decision was made. */
  decidedAtIso: string;
  /** Who made the decision. */
  decidedByUserId: UserIdType;
  /** Assessed risk level. */
  riskLevel: DecisionRiskLevel;
  /** Hash of the snapshot binding at decision time (drift check). */
  snapshotBindingHash?: HashSha256Type;
  /** Policy evaluations that informed the decision. */
  policyEvaluations: readonly PolicyEvaluationRefV1[];
  /** Evidence considered during the decision. */
  evidenceRefs: readonly EvidenceRefV1[];
  /** AI assistance context (if method is 'ai_assisted'). */
  aiContext?: AiAssistanceContextV1;
  /** Optional: conditions or caveats attached to the decision. */
  conditions: readonly string[];
}>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DecisionRecordValidationError extends Error {
  public override readonly name = 'DecisionRecordValidationError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Input for creating a decision record. */
export interface DecisionRecordInput {
  approvalId: ApprovalIdType;
  workspaceId: WorkspaceIdType;
  decision: ApprovalDecision;
  method: DecisionMethod;
  rationale: string;
  decidedAtIso: string;
  decidedByUserId: UserIdType;
  riskLevel: DecisionRiskLevel;
  snapshotBindingHash?: HashSha256Type;
  policyEvaluations?: readonly PolicyEvaluationRefV1[];
  evidenceRefs?: readonly EvidenceRefV1[];
  aiContext?: AiAssistanceContextV1;
  conditions?: readonly string[];
}

/**
 * Create an immutable approval decision record.
 *
 * Validates all fields and deep-freezes the result.
 *
 * Invariants:
 *   - rationale must be non-empty
 *   - decidedAtIso must be non-empty
 *   - if method is 'ai_assisted', aiContext must be provided
 *   - aiContext.confidenceScore must be between 0 and 1
 *   - policy evaluation outcomes must be valid
 */
export function createDecisionRecord(input: DecisionRecordInput): ApprovalDecisionRecordV1 {
  // Validate rationale
  if (!input.rationale || input.rationale.trim().length === 0) {
    throw new DecisionRecordValidationError('rationale must be non-empty');
  }

  // Validate decidedAtIso
  if (!input.decidedAtIso || input.decidedAtIso.trim().length === 0) {
    throw new DecisionRecordValidationError('decidedAtIso must be non-empty');
  }

  // Validate AI context requirement
  if (input.method === 'ai_assisted' && !input.aiContext) {
    throw new DecisionRecordValidationError('aiContext is required when method is "ai_assisted"');
  }

  // Validate AI confidence score
  if (input.aiContext) {
    if (input.aiContext.confidenceScore < 0 || input.aiContext.confidenceScore > 1) {
      throw new DecisionRecordValidationError(
        `aiContext.confidenceScore must be between 0 and 1, got ${String(input.aiContext.confidenceScore)}`,
      );
    }
  }

  // Validate policy evaluation outcomes
  const validOutcomes = ['Pass', 'Fail', 'NeedsHuman'];
  for (const pe of input.policyEvaluations ?? []) {
    if (!validOutcomes.includes(pe.outcome)) {
      throw new DecisionRecordValidationError(`Invalid policy evaluation outcome: "${pe.outcome}"`);
    }
  }

  const record: ApprovalDecisionRecordV1 = {
    schemaVersion: 1,
    approvalId: input.approvalId,
    workspaceId: input.workspaceId,
    decision: input.decision,
    method: input.method,
    rationale: input.rationale.trim(),
    decidedAtIso: input.decidedAtIso,
    decidedByUserId: input.decidedByUserId,
    riskLevel: input.riskLevel,
    ...(input.snapshotBindingHash !== undefined
      ? { snapshotBindingHash: input.snapshotBindingHash }
      : {}),
    policyEvaluations: [...(input.policyEvaluations ?? [])],
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    ...(input.aiContext !== undefined ? { aiContext: input.aiContext } : {}),
    conditions: [...(input.conditions ?? [])],
  };

  return deepFreeze(record);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Check whether a decision record has any failing policy evaluations.
 */
export function hasFailingPolicies(record: ApprovalDecisionRecordV1): boolean {
  return record.policyEvaluations.some((pe) => pe.outcome === 'Fail');
}

/**
 * Check whether a decision record has decisive evidence.
 */
export function hasDecisiveEvidence(record: ApprovalDecisionRecordV1): boolean {
  return record.evidenceRefs.some((e) => e.decisive);
}

/**
 * Check whether the human agreed with the AI recommendation
 * (only meaningful for ai_assisted decisions).
 */
export function humanAgreedWithAi(record: ApprovalDecisionRecordV1): boolean | null {
  if (!record.aiContext) return null;
  return record.aiContext.humanAgreedWithAi;
}

/**
 * Get a summary of the decision for audit display.
 */
export function summarizeDecision(record: ApprovalDecisionRecordV1): string {
  const parts: string[] = [
    `Decision: ${record.decision}`,
    `Method: ${record.method}`,
    `Risk: ${record.riskLevel}`,
  ];

  if (record.policyEvaluations.length > 0) {
    const passing = record.policyEvaluations.filter((p) => p.outcome === 'Pass').length;
    parts.push(`Policies: ${String(passing)}/${String(record.policyEvaluations.length)} passing`);
  }

  if (record.evidenceRefs.length > 0) {
    parts.push(`Evidence: ${String(record.evidenceRefs.length)} items`);
  }

  if (record.aiContext) {
    parts.push(`AI confidence: ${String(Math.round(record.aiContext.confidenceScore * 100))}%`);
  }

  if (record.conditions.length > 0) {
    parts.push(`Conditions: ${String(record.conditions.length)}`);
  }

  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj as object)) {
    const child = (obj as Record<string, unknown>)[key];
    if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return obj;
}
