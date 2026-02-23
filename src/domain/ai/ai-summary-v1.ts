/**
 * AI Summary domain model for approval workflows (bead-9p77).
 *
 * Defines the structured output of an AI-generated approval summary.
 * The summary is composed of sections (risk assessment, blast radius,
 * recommendation, key facts) each with source attributions and confidence.
 *
 * The AI summary is always paired with:
 *   - An `AiInteractionAuditV1` (what the model saw and produced)
 *   - An `AiExplanationV1` (why the model said what it said)
 *
 * This module is pure domain code with zero external dependencies.
 * The infrastructure layer provides the actual LLM integration.
 */

import type {
  ApprovalId,
  CorrelationId,
  HashSha256,
  UserId,
  WorkspaceId,
} from '../primitives/index.js';
import type {
  AiConfidenceBand,
  AiExplanationV1,
  AiInteractionAuditV1,
} from './responsible-ai-v1.js';

// ---------------------------------------------------------------------------
// Summary section types
// ---------------------------------------------------------------------------

/**
 * A single section of an AI-generated approval summary.
 */
export interface AiSummarySectionV1 {
  readonly sectionType:
    | 'risk_assessment'
    | 'blast_radius'
    | 'recommendation'
    | 'key_facts'
    | 'compliance_notes'
    | 'historical_context';
  /** Plain-text content of this section. */
  readonly content: string;
  /** Confidence for this specific section (may differ from overall). */
  readonly sectionConfidence: AiConfidenceBand;
  /** Source reference IDs that support this section. */
  readonly sourceRefIds: readonly string[];
}

/**
 * AI recommendation for the approval decision.
 */
export type AiRecommendation =
  | 'approve'
  | 'deny'
  | 'request_changes'
  | 'escalate'
  | 'insufficient_data';

// ---------------------------------------------------------------------------
// AI summary value object
// ---------------------------------------------------------------------------

/**
 * Complete AI-generated summary for an approval request.
 *
 * This is a value object — frozen, immutable, and deterministically
 * reproducible given the same inputs and model version.
 */
export interface AiApprovalSummaryV1 {
  readonly schemaVersion: 1;
  readonly summaryId: string;
  readonly workspaceId: WorkspaceId;
  readonly approvalId: ApprovalId;
  readonly correlationId: CorrelationId;
  /** The overall plain-text summary (for UI display). */
  readonly overallSummary: string;
  /** Structured sections with per-section confidence. */
  readonly sections: readonly AiSummarySectionV1[];
  /** AI recommendation (may be suppressed by agency boundary). */
  readonly recommendation: AiRecommendation;
  /** Overall confidence for the summary. */
  readonly confidence: AiConfidenceBand;
  readonly confidenceScore: number;
  /** Whether PII was found and redacted from the input context. */
  readonly inputPiiRedacted: boolean;
  /** Whether PII was found in the model output (and redacted). */
  readonly outputPiiRedacted: boolean;
  /** Model identity. */
  readonly modelId: string;
  readonly modelVersion: string;
  /** Timestamp of generation. */
  readonly generatedAtIso: string;
  /** Who triggered the summary generation. */
  readonly requestedByUserId: UserId;
  /** Hash of the approval payload at time of summary generation. */
  readonly approvalPayloadHash: HashSha256;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildAiSummaryParams {
  summaryId: string;
  workspaceId: WorkspaceId;
  approvalId: ApprovalId;
  correlationId: CorrelationId;
  overallSummary: string;
  sections: AiSummarySectionV1[];
  recommendation: AiRecommendation;
  confidenceScore: number;
  inputPiiRedacted: boolean;
  outputPiiRedacted: boolean;
  modelId: string;
  modelVersion: string;
  generatedAtIso: string;
  requestedByUserId: UserId;
  approvalPayloadHash: HashSha256;
}

/**
 * Build a frozen AI approval summary value object.
 */
export function buildAiApprovalSummary(params: BuildAiSummaryParams): AiApprovalSummaryV1 {
  if (params.confidenceScore < 0 || params.confidenceScore > 1) {
    throw new Error(`confidenceScore must be between 0 and 1, got ${params.confidenceScore}`);
  }

  if (params.overallSummary.trim().length === 0) {
    throw new Error('overallSummary must not be empty');
  }

  if (params.sections.length === 0) {
    throw new Error('At least one summary section is required');
  }

  // Import toConfidenceBand inline to avoid circular — but it's in the same module
  // so we can compute it directly
  let confidence: AiConfidenceBand;
  if (params.confidenceScore >= 0.8) confidence = 'high';
  else if (params.confidenceScore >= 0.5) confidence = 'medium';
  else if (params.confidenceScore >= 0.2) confidence = 'low';
  else confidence = 'insufficient_data';

  const summary: AiApprovalSummaryV1 = {
    schemaVersion: 1,
    summaryId: params.summaryId,
    workspaceId: params.workspaceId,
    approvalId: params.approvalId,
    correlationId: params.correlationId,
    overallSummary: params.overallSummary,
    sections: Object.freeze([...params.sections]),
    recommendation: params.recommendation,
    confidence,
    confidenceScore: params.confidenceScore,
    inputPiiRedacted: params.inputPiiRedacted,
    outputPiiRedacted: params.outputPiiRedacted,
    modelId: params.modelId,
    modelVersion: params.modelVersion,
    generatedAtIso: params.generatedAtIso,
    requestedByUserId: params.requestedByUserId,
    approvalPayloadHash: params.approvalPayloadHash,
  };

  return Object.freeze(summary);
}

// ---------------------------------------------------------------------------
// Summary context — what to send to the LLM
// ---------------------------------------------------------------------------

/**
 * Structured context assembled for the LLM prompt.
 * This is the "input package" that gets PII-scanned before sending to the model.
 */
export interface AiSummaryContextV1 {
  readonly approvalId: ApprovalId;
  readonly workspaceId: WorkspaceId;
  readonly prompt: string;
  readonly requestedByUserId: UserId;
  readonly riskLevel: string;
  readonly plannedEffectsSummaries: readonly string[];
  readonly policyOutcomes: readonly {
    policyName: string;
    outcome: string;
    explanation: string;
  }[];
  readonly evidenceSummaries: readonly string[];
  readonly priorDecisionCount: number;
}

/**
 * Build a frozen summary context value object from approval data.
 */
export function buildSummaryContext(params: {
  approvalId: ApprovalId;
  workspaceId: WorkspaceId;
  prompt: string;
  requestedByUserId: UserId;
  riskLevel: string;
  plannedEffectsSummaries: string[];
  policyOutcomes: { policyName: string; outcome: string; explanation: string }[];
  evidenceSummaries: string[];
  priorDecisionCount: number;
}): AiSummaryContextV1 {
  const context: AiSummaryContextV1 = {
    approvalId: params.approvalId,
    workspaceId: params.workspaceId,
    prompt: params.prompt,
    requestedByUserId: params.requestedByUserId,
    riskLevel: params.riskLevel,
    plannedEffectsSummaries: Object.freeze([...params.plannedEffectsSummaries]),
    policyOutcomes: Object.freeze(params.policyOutcomes.map((po) => Object.freeze({ ...po }))),
    evidenceSummaries: Object.freeze([...params.evidenceSummaries]),
    priorDecisionCount: params.priorDecisionCount,
  };

  return Object.freeze(context);
}

/**
 * Serialize summary context to a deterministic string for hashing.
 * Used to produce the promptHash in the audit entry.
 */
export function serializeSummaryContext(context: AiSummaryContextV1): string {
  return JSON.stringify({
    approvalId: context.approvalId,
    workspaceId: context.workspaceId,
    prompt: context.prompt,
    requestedByUserId: context.requestedByUserId,
    riskLevel: context.riskLevel,
    plannedEffectsSummaries: context.plannedEffectsSummaries,
    policyOutcomes: context.policyOutcomes,
    evidenceSummaries: context.evidenceSummaries,
    priorDecisionCount: context.priorDecisionCount,
  });
}

// ---------------------------------------------------------------------------
// AI summary result — complete bundle
// ---------------------------------------------------------------------------

/**
 * The complete result of generating an AI summary, bundling the summary
 * itself with its audit entry and explanation for the evidence chain.
 */
export interface AiSummaryResultV1 {
  readonly summary: AiApprovalSummaryV1;
  readonly audit: AiInteractionAuditV1;
  readonly explanation: AiExplanationV1;
}
