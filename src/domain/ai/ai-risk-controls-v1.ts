/**
 * AI risk controls framework — lightweight NIST AI RMF adoption (bead-64zs).
 *
 * Defines the domain types and validation rules for managing AI risks in
 * Portarium's AI features (advisor, RAG, evidence summarisation). Aligned
 * with the NIST AI Risk Management Framework (AI RMF 1.0) four core
 * functions: Govern, Map, Measure, Manage.
 *
 * Bead: bead-64zs
 * ADR: ADR-0114 (AI Risk Controls — NIST AI RMF Adoption)
 */

import type { WorkspaceId } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// AI feature identifiers
// ---------------------------------------------------------------------------

/**
 * Portarium AI features subject to risk assessment.
 */
const AI_FEATURES = [
  'approval-advisor',
  'evidence-summarisation',
  'rag-retrieval',
  'blast-radius-analysis',
  'risk-assessment',
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

export function isAiFeature(value: string): value is AiFeature {
  return (AI_FEATURES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// NIST AI RMF risk categories
// ---------------------------------------------------------------------------

/**
 * Risk categories from NIST AI RMF mapped to Portarium's context.
 *
 * - validity-reliability: Model outputs must be correct and consistent.
 * - safety: AI must not cause harm (wrong approvals, missed risks).
 * - fairness-bias: AI must not discriminate across workspaces/users.
 * - transparency: AI reasoning must be explainable and auditable.
 * - privacy: AI must not leak PII or cross-workspace data.
 * - security: AI must resist adversarial inputs (prompt injection, data poisoning).
 * - accountability: Clear ownership and incident response for AI failures.
 */
const RISK_CATEGORIES = [
  'validity-reliability',
  'safety',
  'fairness-bias',
  'transparency',
  'privacy',
  'security',
  'accountability',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export function isRiskCategory(value: string): value is RiskCategory {
  return (RISK_CATEGORIES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Impact and likelihood scales
// ---------------------------------------------------------------------------

const IMPACT_LEVELS = ['negligible', 'minor', 'moderate', 'major', 'critical'] as const;

export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export function isImpactLevel(value: string): value is ImpactLevel {
  return (IMPACT_LEVELS as readonly string[]).includes(value);
}

const LIKELIHOOD_LEVELS = ['rare', 'unlikely', 'possible', 'likely', 'almost-certain'] as const;

export type LikelihoodLevel = (typeof LIKELIHOOD_LEVELS)[number];

export function isLikelihoodLevel(value: string): value is LikelihoodLevel {
  return (LIKELIHOOD_LEVELS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Risk rating (impact x likelihood matrix)
// ---------------------------------------------------------------------------

export type RiskRating = 'low' | 'medium' | 'high' | 'critical';

const IMPACT_SCORE: Record<ImpactLevel, number> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  critical: 5,
};

const LIKELIHOOD_SCORE: Record<LikelihoodLevel, number> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  'almost-certain': 5,
};

/**
 * Calculate a risk rating from impact and likelihood using a 5x5 matrix.
 * Score = impact * likelihood. Thresholds: <=4 low, <=9 medium, <=16 high, >16 critical.
 */
export function calculateRiskRating(impact: ImpactLevel, likelihood: LikelihoodLevel): RiskRating {
  const score = IMPACT_SCORE[impact] * LIKELIHOOD_SCORE[likelihood];
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 16) return 'high';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Trust boundary — what AI can influence vs requires human override
// ---------------------------------------------------------------------------

/**
 * Decision authority level for an AI feature in a given context.
 *
 * - inform-only: AI provides information, human makes all decisions.
 * - recommend: AI recommends an action, human must explicitly accept.
 * - auto-with-review: AI acts automatically but human reviews within a window.
 * - auto-no-review: AI acts automatically with no human in the loop (only for lowest risk).
 */
const DECISION_AUTHORITIES = [
  'inform-only',
  'recommend',
  'auto-with-review',
  'auto-no-review',
] as const;

export type DecisionAuthority = (typeof DECISION_AUTHORITIES)[number];

export function isDecisionAuthority(value: string): value is DecisionAuthority {
  return (DECISION_AUTHORITIES as readonly string[]).includes(value);
}

/**
 * A trust boundary defines what level of autonomous decision-making an AI
 * feature is permitted for a given risk rating.
 */
export type AiTrustBoundary = Readonly<{
  /** The AI feature this boundary applies to. */
  feature: AiFeature;
  /** The workspace this boundary is scoped to (workspace-level policy). */
  workspaceId: WorkspaceId;
  /** Decision authority when risk rating is low. */
  authorityWhenLowRisk: DecisionAuthority;
  /** Decision authority when risk rating is medium. */
  authorityWhenMediumRisk: DecisionAuthority;
  /** Decision authority when risk rating is high. */
  authorityWhenHighRisk: DecisionAuthority;
  /** Decision authority when risk rating is critical. */
  authorityWhenCriticalRisk: DecisionAuthority;
}>;

export type TrustBoundaryValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly string[] };

/**
 * Validate a trust boundary for internal consistency.
 *
 * Rules:
 * - Higher risk must never grant more autonomy than lower risk.
 * - Critical risk must be inform-only or recommend (never auto).
 * - High risk must not be auto-no-review.
 */
export function validateTrustBoundary(boundary: AiTrustBoundary): TrustBoundaryValidationResult {
  const violations: string[] = [];

  const authorityRank: Record<DecisionAuthority, number> = {
    'inform-only': 0,
    recommend: 1,
    'auto-with-review': 2,
    'auto-no-review': 3,
  };

  const levels: { label: string; authority: DecisionAuthority }[] = [
    { label: 'low', authority: boundary.authorityWhenLowRisk },
    { label: 'medium', authority: boundary.authorityWhenMediumRisk },
    { label: 'high', authority: boundary.authorityWhenHighRisk },
    { label: 'critical', authority: boundary.authorityWhenCriticalRisk },
  ];

  // Monotonicity: authority must not increase as risk increases
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]!;
    const curr = levels[i]!;
    if (authorityRank[curr.authority] > authorityRank[prev.authority]) {
      violations.push(
        `Authority at '${curr.label}' risk ('${curr.authority}') must not exceed ` +
          `authority at '${prev.label}' risk ('${prev.authority}').`,
      );
    }
  }

  // Critical risk must not be auto
  if (
    boundary.authorityWhenCriticalRisk === 'auto-with-review' ||
    boundary.authorityWhenCriticalRisk === 'auto-no-review'
  ) {
    violations.push(
      `Critical risk must not permit autonomous action, got '${boundary.authorityWhenCriticalRisk}'.`,
    );
  }

  // High risk must not be auto-no-review
  if (boundary.authorityWhenHighRisk === 'auto-no-review') {
    violations.push('High risk must not permit auto-no-review.');
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

/**
 * Resolve the decision authority for a feature given a risk rating.
 */
export function resolveDecisionAuthority(
  boundary: AiTrustBoundary,
  riskRating: RiskRating,
): DecisionAuthority {
  switch (riskRating) {
    case 'low':
      return boundary.authorityWhenLowRisk;
    case 'medium':
      return boundary.authorityWhenMediumRisk;
    case 'high':
      return boundary.authorityWhenHighRisk;
    case 'critical':
      return boundary.authorityWhenCriticalRisk;
  }
}

// ---------------------------------------------------------------------------
// AI monitoring metrics — recommendation accuracy, FP/FN rates
// ---------------------------------------------------------------------------

/**
 * Monitoring metrics for an AI feature over a time window.
 */
export type AiMonitoringMetrics = Readonly<{
  /** The AI feature being monitored. */
  feature: AiFeature;
  /** Start of the measurement window (ISO timestamp). */
  windowStartIso: string;
  /** End of the measurement window (ISO timestamp). */
  windowEndIso: string;
  /** Total number of AI interactions in the window. */
  totalInteractions: number;
  /** Number of recommendations accepted by humans. */
  recommendationsAccepted: number;
  /** Number of recommendations overridden by humans. */
  recommendationsOverridden: number;
  /** False positive count (AI flagged risk that was not real). */
  falsePositives: number;
  /** False negative count (AI missed a real risk). */
  falseNegatives: number;
  /** True positive count. */
  truePositives: number;
  /** True negative count. */
  trueNegatives: number;
  /** Average confidence score across interactions. */
  averageConfidenceScore: number;
  /** Number of interactions where human had to correct AI output. */
  humanCorrectionCount: number;
}>;

export type MetricsValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * Validate monitoring metrics for internal consistency.
 */
export function validateMonitoringMetrics(metrics: AiMonitoringMetrics): MetricsValidationResult {
  if (metrics.totalInteractions < 0) {
    return { valid: false, reason: 'totalInteractions must be non-negative.' };
  }

  const confusionTotal =
    metrics.truePositives + metrics.trueNegatives + metrics.falsePositives + metrics.falseNegatives;

  if (confusionTotal > metrics.totalInteractions) {
    return {
      valid: false,
      reason: `Confusion matrix total (${confusionTotal}) exceeds totalInteractions (${metrics.totalInteractions}).`,
    };
  }

  if (metrics.averageConfidenceScore < 0 || metrics.averageConfidenceScore > 1) {
    return {
      valid: false,
      reason: `averageConfidenceScore must be between 0 and 1, got ${metrics.averageConfidenceScore}.`,
    };
  }

  const acceptedPlusOverridden =
    metrics.recommendationsAccepted + metrics.recommendationsOverridden;
  if (acceptedPlusOverridden > metrics.totalInteractions) {
    return {
      valid: false,
      reason: `accepted + overridden (${acceptedPlusOverridden}) exceeds totalInteractions (${metrics.totalInteractions}).`,
    };
  }

  if (metrics.humanCorrectionCount > metrics.totalInteractions) {
    return {
      valid: false,
      reason: `humanCorrectionCount (${metrics.humanCorrectionCount}) exceeds totalInteractions (${metrics.totalInteractions}).`,
    };
  }

  return { valid: true };
}

/**
 * Calculate the recommendation acceptance rate (0..1).
 * Returns 0 if no recommendations were made.
 */
export function calculateAcceptanceRate(metrics: AiMonitoringMetrics): number {
  const total = metrics.recommendationsAccepted + metrics.recommendationsOverridden;
  if (total === 0) return 0;
  return metrics.recommendationsAccepted / total;
}

/**
 * Calculate precision from the confusion matrix (0..1).
 * Returns 0 if TP + FP = 0.
 */
export function calculatePrecision(metrics: AiMonitoringMetrics): number {
  const denominator = metrics.truePositives + metrics.falsePositives;
  if (denominator === 0) return 0;
  return metrics.truePositives / denominator;
}

/**
 * Calculate recall from the confusion matrix (0..1).
 * Returns 0 if TP + FN = 0.
 */
export function calculateRecall(metrics: AiMonitoringMetrics): number {
  const denominator = metrics.truePositives + metrics.falseNegatives;
  if (denominator === 0) return 0;
  return metrics.truePositives / denominator;
}

// ---------------------------------------------------------------------------
// AI incident classification — bad AI advice leading to wrong approvals
// ---------------------------------------------------------------------------

/**
 * Severity of an AI-related incident.
 */
const INCIDENT_SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'] as const;

export type AiIncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

export function isAiIncidentSeverity(value: string): value is AiIncidentSeverity {
  return (INCIDENT_SEVERITIES as readonly string[]).includes(value);
}

/**
 * Root cause categories for AI incidents.
 */
const INCIDENT_ROOT_CAUSES = [
  'model-hallucination',
  'data-quality',
  'prompt-injection',
  'context-window-overflow',
  'stale-training-data',
  'configuration-error',
  'missing-guardrail',
] as const;

export type AiIncidentRootCause = (typeof INCIDENT_ROOT_CAUSES)[number];

export function isAiIncidentRootCause(value: string): value is AiIncidentRootCause {
  return (INCIDENT_ROOT_CAUSES as readonly string[]).includes(value);
}

/**
 * An AI incident record for tracking bad AI advice that led to incorrect
 * approvals or missed risks.
 */
export type AiIncidentRecord = Readonly<{
  /** Unique identifier for this incident. */
  incidentId: string;
  /** The workspace where the incident occurred. */
  workspaceId: WorkspaceId;
  /** The AI feature involved. */
  feature: AiFeature;
  /** Severity classification. */
  severity: AiIncidentSeverity;
  /** Root cause category. */
  rootCause: AiIncidentRootCause;
  /** Description of what happened. */
  description: string;
  /** The approval or decision that was affected. */
  affectedDecisionRef: string;
  /** Whether the AI output was the primary cause of the wrong decision. */
  aiWasPrimaryCause: boolean;
  /** Whether a human override could have prevented the incident. */
  humanOverrideAvailable: boolean;
  /** ISO timestamp when the incident was detected. */
  detectedAtIso: string;
  /** ISO timestamp when the incident was resolved (if resolved). */
  resolvedAtIso?: string;
  /** Corrective actions taken. */
  correctiveActions: readonly string[];
}>;

export type IncidentValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly violations: readonly string[] };

/**
 * Validate an AI incident record.
 */
export function validateAiIncident(incident: AiIncidentRecord): IncidentValidationResult {
  const violations: string[] = [];

  if (!incident.incidentId.trim()) {
    violations.push('incidentId must be non-empty.');
  }

  if (!incident.description.trim()) {
    violations.push('description must be non-empty.');
  }

  if (!incident.affectedDecisionRef.trim()) {
    violations.push('affectedDecisionRef must be non-empty.');
  }

  if (!incident.detectedAtIso.trim()) {
    violations.push('detectedAtIso must be non-empty.');
  }

  // If resolved, resolvedAt must be after detectedAt
  if (incident.resolvedAtIso) {
    if (incident.resolvedAtIso <= incident.detectedAtIso) {
      violations.push('resolvedAtIso must be after detectedAtIso.');
    }
  }

  // sev1 incidents where AI was primary cause must have corrective actions
  if (
    incident.severity === 'sev1' &&
    incident.aiWasPrimaryCause &&
    incident.correctiveActions.length === 0
  ) {
    violations.push('sev1 incidents where AI was primary cause must have corrective actions.');
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}

// ---------------------------------------------------------------------------
// AI risk assessment — per-feature risk profile
// ---------------------------------------------------------------------------

/**
 * A risk assessment for a specific AI feature, following NIST AI RMF
 * Map function (identify risks) and Measure function (assess severity).
 */
export type AiFeatureRiskAssessment = Readonly<{
  /** The AI feature being assessed. */
  feature: AiFeature;
  /** The workspace this assessment is scoped to. */
  workspaceId: WorkspaceId;
  /** Risk category being assessed. */
  riskCategory: RiskCategory;
  /** Impact if the risk materialises. */
  impact: ImpactLevel;
  /** Likelihood of the risk materialising. */
  likelihood: LikelihoodLevel;
  /** Calculated risk rating. */
  riskRating: RiskRating;
  /** Existing mitigations already in place. */
  existingMitigations: readonly string[];
  /** Residual risk after mitigations. */
  residualRiskRating: RiskRating;
  /** ISO timestamp of the assessment. */
  assessedAtIso: string;
  /** Who performed the assessment. */
  assessedBy: string;
}>;

/**
 * Validate a feature risk assessment for consistency.
 */
export function validateFeatureRiskAssessment(
  assessment: AiFeatureRiskAssessment,
): TrustBoundaryValidationResult {
  const violations: string[] = [];

  // Calculated rating must match impact x likelihood
  const expected = calculateRiskRating(assessment.impact, assessment.likelihood);
  if (assessment.riskRating !== expected) {
    violations.push(
      `riskRating '${assessment.riskRating}' does not match calculated rating '${expected}' ` +
        `for impact '${assessment.impact}' x likelihood '${assessment.likelihood}'.`,
    );
  }

  // Residual risk must not exceed inherent risk
  const ratingRank: Record<RiskRating, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  if (ratingRank[assessment.residualRiskRating] > ratingRank[assessment.riskRating]) {
    violations.push(
      `Residual risk '${assessment.residualRiskRating}' must not exceed ` +
        `inherent risk '${assessment.riskRating}'.`,
    );
  }

  if (!assessment.assessedBy.trim()) {
    violations.push('assessedBy must be non-empty.');
  }

  if (!assessment.assessedAtIso.trim()) {
    violations.push('assessedAtIso must be non-empty.');
  }

  if (violations.length === 0) return { valid: true };
  return { valid: false, violations };
}
