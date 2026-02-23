/**
 * LLM confidence signal and overreliance guardrails (bead-tz6c).
 *
 * When an LLM agent produces a recommendation (e.g., approval suggestion,
 * risk assessment, deployment summary), the system must communicate the
 * confidence level to the human operator.  This prevents overreliance on
 * AI outputs and ensures operators apply appropriate scrutiny.
 *
 * Design:
 *  - Confidence is a normalised score in [0, 1].
 *  - Each score maps to a `ConfidenceBand` that drives UI treatment.
 *  - A `ConfidenceSignal` bundles the score with structured metadata
 *    about why the model is uncertain.
 *  - Validation functions ensure signals are well-formed before
 *    rendering in the cockpit UI.
 *
 * All functions are pure, dependency-free, and suitable for the domain layer.
 */

// ---------------------------------------------------------------------------
// Confidence bands
// ---------------------------------------------------------------------------

/**
 * Confidence bands that map to distinct UI treatments:
 *
 * - **High**    (>= 0.8): Green indicator, standard display.
 * - **Medium**  (>= 0.5, < 0.8): Amber indicator, "review recommended" banner.
 * - **Low**     (>= 0.2, < 0.5): Red indicator, prominent warning.
 * - **VeryLow** (< 0.2): Red indicator + forced acknowledgement before proceeding.
 */
export type ConfidenceBand = 'High' | 'Medium' | 'Low' | 'VeryLow';

/**
 * Map a normalised confidence score to a band.
 */
export function toConfidenceBand(score: number): ConfidenceBand {
  if (score >= 0.8) return 'High';
  if (score >= 0.5) return 'Medium';
  if (score >= 0.2) return 'Low';
  return 'VeryLow';
}

// ---------------------------------------------------------------------------
// Uncertainty reasons
// ---------------------------------------------------------------------------

/**
 * Structured reasons for low confidence.  Each reason has a distinct
 * remediation path in the UI.
 */
export type UncertaintyReason =
  | 'InsufficientEvidence'
  | 'ConflictingSignals'
  | 'OutOfDistribution'
  | 'HighStakesDecision'
  | 'AmbiguousContext';

// ---------------------------------------------------------------------------
// Confidence signal
// ---------------------------------------------------------------------------

/**
 * A confidence signal attached to every LLM-generated recommendation.
 */
export type ConfidenceSignal = Readonly<{
  /** Normalised confidence score in [0, 1]. */
  score: number;
  /** Which band this score falls into. */
  band: ConfidenceBand;
  /** Why the model is uncertain (empty if High confidence). */
  uncertaintyReasons: readonly UncertaintyReason[];
  /** Whether the operator must explicitly acknowledge before acting. */
  requiresAcknowledgement: boolean;
  /** Short human-readable explanation of the confidence assessment. */
  explanation: string;
}>;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ConfidenceValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: string };

/**
 * Validate that a confidence signal is well-formed.
 */
export function validateConfidenceSignal(signal: ConfidenceSignal): ConfidenceValidationResult {
  if (signal.score < 0 || signal.score > 1) {
    return {
      valid: false,
      reason: `Confidence score must be in [0, 1], got ${signal.score}.`,
    };
  }

  if (!Number.isFinite(signal.score)) {
    return {
      valid: false,
      reason: `Confidence score must be a finite number, got ${signal.score}.`,
    };
  }

  const expectedBand = toConfidenceBand(signal.score);
  if (signal.band !== expectedBand) {
    return {
      valid: false,
      reason: `Confidence band mismatch: score ${signal.score} maps to '${expectedBand}', got '${signal.band}'.`,
    };
  }

  if (!signal.explanation.trim()) {
    return { valid: false, reason: 'Confidence explanation must be non-empty.' };
  }

  if (signal.band === 'VeryLow' && !signal.requiresAcknowledgement) {
    return {
      valid: false,
      reason: 'VeryLow confidence signals must require operator acknowledgement.',
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const VALID_UNCERTAINTY_REASONS: readonly UncertaintyReason[] = [
  'InsufficientEvidence',
  'ConflictingSignals',
  'OutOfDistribution',
  'HighStakesDecision',
  'AmbiguousContext',
];

/**
 * Check whether a string is a valid UncertaintyReason.
 */
export function isUncertaintyReason(value: string): value is UncertaintyReason {
  return (VALID_UNCERTAINTY_REASONS as readonly string[]).includes(value);
}

/**
 * Build a well-formed confidence signal from a score and reasons.
 *
 * Automatically derives the band and sets `requiresAcknowledgement` for
 * VeryLow and Low confidence.
 */
export function buildConfidenceSignal(
  score: number,
  explanation: string,
  uncertaintyReasons: readonly UncertaintyReason[] = [],
): ConfidenceSignal {
  const band = toConfidenceBand(score);
  return {
    score,
    band,
    uncertaintyReasons,
    requiresAcknowledgement: band === 'VeryLow' || band === 'Low',
    explanation,
  };
}
