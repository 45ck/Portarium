/**
 * Responsible AI foundations for AI-assisted approvals (bead-im6n).
 *
 * Provides pure domain types and validation functions for:
 *   1. PII guardrails — detect PII patterns in LLM inputs/outputs, produce
 *      redaction reports before content enters the audit trail.
 *   2. AI audit logging — structured audit entries for every LLM interaction
 *      capturing model ID, prompt hash, response hash, redaction state, and
 *      latency. Feeds into the evidence chain.
 *   3. Explainability — structured explanations for AI-generated summaries
 *      with confidence scores, source attribution, and reasoning chains.
 *      Ensures the operator can always answer "why did the AI say this?".
 *
 * Constraints:
 *   - Zero external dependencies (pure domain code).
 *   - All output types are deeply frozen (immutable value objects).
 *   - PII detection is best-effort pattern matching; the infrastructure layer
 *     may augment with ML-based NER. The domain contract defines what
 *     categories we track and what the redaction report looks like.
 */

import type {
  ApprovalId,
  CorrelationId,
  HashSha256,
  UserId,
  WorkspaceId,
} from '../primitives/index.js';

// ---------------------------------------------------------------------------
// PII category taxonomy
// ---------------------------------------------------------------------------

/**
 * Standard PII categories detected before content reaches the audit trail.
 * Mirrors common regulatory taxonomies (GDPR Art. 9, CCPA §1798.140).
 */
export type PiiCategory =
  | 'email'
  | 'phone_number'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'person_name'
  | 'postal_address'
  | 'date_of_birth';

/** A single PII detection within a text field. */
export interface PiiDetectionV1 {
  readonly category: PiiCategory;
  /** Character offset where the PII starts in the original text. */
  readonly startOffset: number;
  /** Character offset where the PII ends (exclusive). */
  readonly endOffset: number;
  /** The replacement token used in the redacted output. */
  readonly replacementToken: string;
}

/** Result of scanning a text field for PII. */
export interface PiiScanResultV1 {
  readonly schemaVersion: 1;
  /** Original text length (characters). */
  readonly originalLength: number;
  /** Redacted text with PII tokens replaced. */
  readonly redactedText: string;
  /** All detections found, in order of appearance. */
  readonly detections: readonly PiiDetectionV1[];
  /** True when at least one detection was found. */
  readonly containsPii: boolean;
}

// ---------------------------------------------------------------------------
// PII detection patterns (best-effort regex; infrastructure may augment)
// ---------------------------------------------------------------------------

interface PiiPattern {
  readonly category: PiiCategory;
  readonly regex: RegExp;
  readonly tokenPrefix: string;
}

const PII_PATTERNS: readonly PiiPattern[] = [
  {
    category: 'email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    tokenPrefix: '[EMAIL',
  },
  {
    category: 'phone_number',
    regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    tokenPrefix: '[PHONE',
  },
  {
    category: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    tokenPrefix: '[SSN',
  },
  {
    category: 'credit_card',
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    tokenPrefix: '[CC',
  },
  {
    category: 'ip_address',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    tokenPrefix: '[IP',
  },
];

/**
 * Scan text for PII patterns and produce a redacted version.
 *
 * Returns a frozen `PiiScanResultV1`. The redacted text replaces each
 * match with a deterministic token like `[EMAIL-1]`, `[PHONE-2]` etc.
 */
export function scanForPii(text: string): PiiScanResultV1 {
  const detections: PiiDetectionV1[] = [];

  // Collect all matches across all patterns
  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        category: pattern.category,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        replacementToken: '', // filled below after sorting
      });
    }
  }

  // Sort by start offset (stable for overlapping ranges — first match wins)
  detections.sort((a, b) => a.startOffset - b.startOffset);

  // De-duplicate overlapping ranges (keep earliest)
  const deduped: PiiDetectionV1[] = [];
  let lastEnd = -1;
  const counterByCategory: Partial<Record<PiiCategory, number>> = {};

  for (const det of detections) {
    if (det.startOffset < lastEnd) continue; // overlaps with previous
    const count = (counterByCategory[det.category] ?? 0) + 1;
    counterByCategory[det.category] = count;

    const patternDef = PII_PATTERNS.find((p) => p.category === det.category);
    const token = `${patternDef?.tokenPrefix ?? '[PII'}-${count}]`;

    deduped.push({
      ...det,
      replacementToken: token,
    });
    lastEnd = det.endOffset;
  }

  // Build redacted text by replacing from end to start
  let redacted = text;
  for (let i = deduped.length - 1; i >= 0; i--) {
    const d = deduped[i]!;
    redacted = redacted.slice(0, d.startOffset) + d.replacementToken + redacted.slice(d.endOffset);
  }

  const result: PiiScanResultV1 = {
    schemaVersion: 1,
    originalLength: text.length,
    redactedText: redacted,
    detections: Object.freeze([...deduped]),
    containsPii: deduped.length > 0,
  };

  return Object.freeze(result);
}

// ---------------------------------------------------------------------------
// AI interaction audit entry
// ---------------------------------------------------------------------------

/**
 * The purpose of an AI interaction within the approval workflow.
 */
export type AiInteractionPurpose =
  | 'approval_summary'
  | 'risk_assessment'
  | 'policy_explanation'
  | 'evidence_synthesis'
  | 'blast_radius_analysis';

/**
 * Audit entry for a single AI/LLM interaction.
 *
 * Captures everything needed to reproduce or investigate an AI-generated
 * output: model identity, prompt/response hashes, PII state, latency.
 */
export interface AiInteractionAuditV1 {
  readonly schemaVersion: 1;
  readonly interactionId: string;
  readonly workspaceId: WorkspaceId;
  readonly approvalId: ApprovalId;
  readonly correlationId: CorrelationId;
  readonly purpose: AiInteractionPurpose;
  readonly modelId: string;
  readonly modelVersion: string;
  /** SHA-256 hash of the prompt sent to the model. */
  readonly promptHash: HashSha256;
  /** SHA-256 hash of the raw model response. */
  readonly responseHash: HashSha256;
  /** Whether PII was detected and redacted before sending to the model. */
  readonly inputPiiRedacted: boolean;
  /** Number of PII detections in the input. */
  readonly inputPiiCount: number;
  /** Whether PII was detected in the model output. */
  readonly outputPiiDetected: boolean;
  /** Number of PII detections in the output. */
  readonly outputPiiCount: number;
  /** Token count for the prompt (if available). */
  readonly promptTokens?: number;
  /** Token count for the response (if available). */
  readonly responseTokens?: number;
  /** Latency in milliseconds from request to response. */
  readonly latencyMs: number;
  /** ISO timestamp when the interaction occurred. */
  readonly occurredAtIso: string;
  /** The user who triggered this AI interaction. */
  readonly triggeredByUserId: UserId;
}

/**
 * Build an AI interaction audit entry. Returns a frozen value object.
 */
export function buildAiInteractionAudit(params: {
  interactionId: string;
  workspaceId: WorkspaceId;
  approvalId: ApprovalId;
  correlationId: CorrelationId;
  purpose: AiInteractionPurpose;
  modelId: string;
  modelVersion: string;
  promptHash: HashSha256;
  responseHash: HashSha256;
  inputScan: PiiScanResultV1;
  outputScan: PiiScanResultV1;
  latencyMs: number;
  occurredAtIso: string;
  triggeredByUserId: UserId;
  promptTokens?: number;
  responseTokens?: number;
}): AiInteractionAuditV1 {
  if (params.latencyMs < 0) {
    throw new Error('latencyMs must be non-negative');
  }

  const entry: AiInteractionAuditV1 = {
    schemaVersion: 1,
    interactionId: params.interactionId,
    workspaceId: params.workspaceId,
    approvalId: params.approvalId,
    correlationId: params.correlationId,
    purpose: params.purpose,
    modelId: params.modelId,
    modelVersion: params.modelVersion,
    promptHash: params.promptHash,
    responseHash: params.responseHash,
    inputPiiRedacted: params.inputScan.containsPii,
    inputPiiCount: params.inputScan.detections.length,
    outputPiiDetected: params.outputScan.containsPii,
    outputPiiCount: params.outputScan.detections.length,
    latencyMs: params.latencyMs,
    occurredAtIso: params.occurredAtIso,
    triggeredByUserId: params.triggeredByUserId,
    ...(params.promptTokens !== undefined ? { promptTokens: params.promptTokens } : {}),
    ...(params.responseTokens !== undefined ? { responseTokens: params.responseTokens } : {}),
  };

  return Object.freeze(entry);
}

// ---------------------------------------------------------------------------
// Explainability — AI-generated content explanation
// ---------------------------------------------------------------------------

/**
 * A single source attribution for an AI-generated conclusion.
 */
export interface AiSourceAttributionV1 {
  /** Human-readable label for the source. */
  readonly sourceLabel: string;
  /** The type of source that contributed to this attribution. */
  readonly sourceType: 'evidence_entry' | 'policy_rule' | 'plan_effect' | 'historical_decision';
  /** Reference ID to the original source object. */
  readonly sourceRefId: string;
  /** Relevance score from the model (0..1, higher = more relevant). */
  readonly relevanceScore: number;
  /** Short excerpt or quote from the source used by the model. */
  readonly excerpt?: string;
}

/**
 * A single step in the AI's reasoning chain.
 */
export interface AiReasoningStepV1 {
  /** Position in the reasoning chain (1-based). */
  readonly stepNumber: number;
  /** Plain-English description of this reasoning step. */
  readonly description: string;
  /** Source attributions that support this step. */
  readonly supportingSources: readonly string[];
}

/**
 * Confidence band for AI-generated output.
 */
export type AiConfidenceBand = 'high' | 'medium' | 'low' | 'insufficient_data';

/**
 * Structured explanation for AI-generated content in approval workflows.
 *
 * Ensures every AI output can answer:
 *   - What sources contributed to this conclusion?
 *   - How confident is the model?
 *   - What was the reasoning chain?
 *   - Are there known limitations or caveats?
 */
export interface AiExplanationV1 {
  readonly schemaVersion: 1;
  readonly explanationId: string;
  readonly interactionId: string;
  readonly purpose: AiInteractionPurpose;
  /** Confidence band for the overall AI output. */
  readonly confidence: AiConfidenceBand;
  /** Numeric confidence score (0..1). */
  readonly confidenceScore: number;
  /** Sources the AI cited in generating its output. */
  readonly sourceAttributions: readonly AiSourceAttributionV1[];
  /** Ordered reasoning chain describing how the AI arrived at its conclusion. */
  readonly reasoningChain: readonly AiReasoningStepV1[];
  /** Known limitations or caveats the operator should consider. */
  readonly caveats: readonly string[];
  /** Whether the AI flagged this output as requiring human verification. */
  readonly requiresHumanVerification: boolean;
}

/**
 * Map a numeric confidence score to a human-readable confidence band.
 */
export function toConfidenceBand(score: number): AiConfidenceBand {
  if (score < 0 || score > 1) {
    throw new Error(`Confidence score must be between 0 and 1, got ${score}`);
  }
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.2) return 'low';
  return 'insufficient_data';
}

/**
 * Build a frozen AI explanation value object.
 */
export function buildAiExplanation(params: {
  explanationId: string;
  interactionId: string;
  purpose: AiInteractionPurpose;
  confidenceScore: number;
  sourceAttributions: AiSourceAttributionV1[];
  reasoningChain: AiReasoningStepV1[];
  caveats: string[];
  requiresHumanVerification: boolean;
}): AiExplanationV1 {
  if (params.confidenceScore < 0 || params.confidenceScore > 1) {
    throw new Error(`confidenceScore must be between 0 and 1, got ${params.confidenceScore}`);
  }

  // Validate reasoning chain step numbers are sequential
  for (let i = 0; i < params.reasoningChain.length; i++) {
    const step = params.reasoningChain[i]!;
    if (step.stepNumber !== i + 1) {
      throw new Error(
        `Reasoning chain step numbers must be sequential 1..N, got ${step.stepNumber} at position ${i}`,
      );
    }
  }

  // Validate source attribution relevance scores
  for (const attr of params.sourceAttributions) {
    if (attr.relevanceScore < 0 || attr.relevanceScore > 1) {
      throw new Error(
        `Source attribution relevanceScore must be between 0 and 1, got ${attr.relevanceScore}`,
      );
    }
  }

  const explanation: AiExplanationV1 = {
    schemaVersion: 1,
    explanationId: params.explanationId,
    interactionId: params.interactionId,
    purpose: params.purpose,
    confidence: toConfidenceBand(params.confidenceScore),
    confidenceScore: params.confidenceScore,
    sourceAttributions: Object.freeze([...params.sourceAttributions]),
    reasoningChain: Object.freeze([...params.reasoningChain]),
    caveats: Object.freeze([...params.caveats]),
    requiresHumanVerification: params.requiresHumanVerification,
  };

  return Object.freeze(explanation);
}

// ---------------------------------------------------------------------------
// Agency boundaries — scope limits for AI-assisted decisions
// ---------------------------------------------------------------------------

/**
 * Defines what actions an AI is permitted to take within an approval workflow.
 * The agency boundary is set per-workspace and per-policy; the AI must never
 * exceed these limits even if the model suggests otherwise.
 */
export interface AiAgencyBoundaryV1 {
  readonly schemaVersion: 1;
  /** Whether the AI may generate summaries for this approval type. */
  readonly canGenerateSummaries: boolean;
  /** Whether the AI may suggest a decision (approve/deny). */
  readonly canSuggestDecision: boolean;
  /** Whether the AI may auto-approve low-risk approvals. */
  readonly canAutoApprove: boolean;
  /** Maximum confidence band at which auto-approval is allowed. */
  readonly autoApproveMinConfidence: AiConfidenceBand;
  /** Risk levels where AI suggestions are suppressed. */
  readonly suppressedRiskLevels: readonly string[];
  /** Whether AI-generated content must be explicitly marked in the UI. */
  readonly requireAiDisclosure: boolean;
}

/**
 * Validate whether a proposed AI action is within agency boundaries.
 */
export function validateAgencyBoundary(
  boundary: AiAgencyBoundaryV1,
  action: {
    type: 'generate_summary' | 'suggest_decision' | 'auto_approve';
    confidenceBand?: AiConfidenceBand;
    riskLevel?: string;
  },
): { allowed: boolean; reason: string } {
  // Check risk level suppression
  if (action.riskLevel && boundary.suppressedRiskLevels.includes(action.riskLevel)) {
    return {
      allowed: false,
      reason: `AI actions are suppressed for risk level "${action.riskLevel}"`,
    };
  }

  switch (action.type) {
    case 'generate_summary':
      return boundary.canGenerateSummaries
        ? { allowed: true, reason: 'Summary generation is permitted' }
        : { allowed: false, reason: 'Summary generation is not permitted by agency boundary' };

    case 'suggest_decision':
      return boundary.canSuggestDecision
        ? { allowed: true, reason: 'Decision suggestion is permitted' }
        : { allowed: false, reason: 'Decision suggestion is not permitted by agency boundary' };

    case 'auto_approve': {
      if (!boundary.canAutoApprove) {
        return { allowed: false, reason: 'Auto-approval is not permitted by agency boundary' };
      }
      if (!action.confidenceBand) {
        return { allowed: false, reason: 'Auto-approval requires a confidence band' };
      }
      const bandOrder: Record<AiConfidenceBand, number> = {
        high: 3,
        medium: 2,
        low: 1,
        insufficient_data: 0,
      };
      const actual = bandOrder[action.confidenceBand];
      const required = bandOrder[boundary.autoApproveMinConfidence];
      if (actual < required) {
        return {
          allowed: false,
          reason: `Auto-approval requires confidence "${boundary.autoApproveMinConfidence}" or higher, got "${action.confidenceBand}"`,
        };
      }
      return { allowed: true, reason: 'Auto-approval confidence threshold met' };
    }
  }
}
