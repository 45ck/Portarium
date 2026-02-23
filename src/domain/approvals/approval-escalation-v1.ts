/**
 * Approval Escalation Engine (bead-0814).
 *
 * Evaluates escalation chains against elapsed time to determine which
 * escalation step should be activated. Supports:
 *   - Multi-step escalation chains (ordered by afterHours)
 *   - SLA deadline computation from request time + escalation chain
 *   - Current step resolution given elapsed time
 *   - Escalation status summary for audit/display
 *
 * Works with the `EscalationStepV1` type from approval-v1.ts.
 *
 * This is a domain value object module — no side effects, no external deps.
 */

import type { UserId as UserIdType } from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types (re-declare to avoid cross-module coupling with approval-v1)
// ---------------------------------------------------------------------------

/**
 * A step in an escalation chain.
 * Compatible with `EscalationStepV1` from approval-v1.ts.
 */
export type EscalationStepInput = Readonly<{
  /** Order in the chain (lower = earlier). */
  stepOrder: number;
  /** User to escalate to at this step. */
  escalateToUserId: string;
  /** Hours after request before this step activates. */
  afterHours: number;
}>;

/** Result of evaluating an escalation chain at a point in time. */
export type EscalationEvaluationV1 = Readonly<{
  /** Whether the escalation chain has been triggered. */
  isEscalated: boolean;
  /** The currently active escalation step, or null if not escalated. */
  activeStep: EscalationStepInput | null;
  /** The index of the active step in the sorted chain (0-based), or -1. */
  activeStepIndex: number;
  /** Total number of steps in the chain. */
  totalSteps: number;
  /** Hours elapsed since the approval was requested. */
  elapsedHours: number;
  /** Whether all escalation steps have been triggered (highest step active). */
  fullyEscalated: boolean;
  /** The sorted escalation chain used for evaluation. */
  sortedChain: readonly EscalationStepInput[];
}>;

/** SLA information computed from an escalation chain. */
export type EscalationSlaV1 = Readonly<{
  /** ISO-8601 deadline for the first escalation step. */
  firstEscalationAtIso: string;
  /** ISO-8601 deadline for the final escalation step. */
  finalEscalationAtIso: string;
  /** Total SLA window in hours (from request to final escalation). */
  totalSlaHours: number;
  /** Per-step deadlines. */
  stepDeadlines: readonly EscalationStepDeadlineV1[];
}>;

/** A deadline for a specific escalation step. */
export type EscalationStepDeadlineV1 = Readonly<{
  stepOrder: number;
  escalateToUserId: string;
  afterHours: number;
  deadlineIso: string;
}>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EscalationValidationError extends Error {
  public override readonly name = 'EscalationValidationError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * Sort an escalation chain by afterHours (ascending), then by stepOrder.
 * Returns a new sorted array.
 */
export function sortEscalationChain(
  chain: readonly EscalationStepInput[],
): readonly EscalationStepInput[] {
  return [...chain].sort((a, b) => {
    if (a.afterHours !== b.afterHours) return a.afterHours - b.afterHours;
    return a.stepOrder - b.stepOrder;
  });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate an escalation chain at a given point in time.
 *
 * Determines which escalation step (if any) is currently active based
 * on how much time has elapsed since the approval was requested.
 *
 * @param chain         - The escalation chain to evaluate.
 * @param requestedAtIso - When the approval was requested.
 * @param evaluatedAtIso - The current time (when to evaluate).
 */
export function evaluateEscalation(
  chain: readonly EscalationStepInput[],
  requestedAtIso: string,
  evaluatedAtIso: string,
): EscalationEvaluationV1 {
  if (chain.length === 0) {
    throw new EscalationValidationError('Escalation chain must contain at least one step.');
  }

  const sorted = sortEscalationChain(chain);
  const requestedAt = new Date(requestedAtIso).getTime();
  const evaluatedAt = new Date(evaluatedAtIso).getTime();
  const elapsedMs = evaluatedAt - requestedAt;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // Find the highest step that has been triggered
  let activeStepIndex = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (elapsedHours >= sorted[i]!.afterHours) {
      activeStepIndex = i;
      break;
    }
  }

  const isEscalated = activeStepIndex >= 0;
  const activeStep = isEscalated ? sorted[activeStepIndex]! : null;
  const fullyEscalated = activeStepIndex === sorted.length - 1;

  return Object.freeze({
    isEscalated,
    activeStep,
    activeStepIndex,
    totalSteps: sorted.length,
    elapsedHours,
    fullyEscalated,
    sortedChain: Object.freeze(sorted),
  });
}

// ---------------------------------------------------------------------------
// SLA computation
// ---------------------------------------------------------------------------

/**
 * Compute SLA deadlines from an escalation chain and request time.
 *
 * Returns the absolute ISO-8601 deadline for each step.
 */
export function computeEscalationSla(
  chain: readonly EscalationStepInput[],
  requestedAtIso: string,
): EscalationSlaV1 {
  if (chain.length === 0) {
    throw new EscalationValidationError('Escalation chain must contain at least one step.');
  }

  const sorted = sortEscalationChain(chain);
  const requestedAt = new Date(requestedAtIso).getTime();

  const stepDeadlines: EscalationStepDeadlineV1[] = sorted.map((step) => {
    const deadlineMs = requestedAt + step.afterHours * 60 * 60 * 1000;
    return Object.freeze({
      stepOrder: step.stepOrder,
      escalateToUserId: step.escalateToUserId,
      afterHours: step.afterHours,
      deadlineIso: new Date(deadlineMs).toISOString(),
    });
  });

  const firstDeadline = stepDeadlines[0]!;
  const lastDeadline = stepDeadlines[stepDeadlines.length - 1]!;

  return Object.freeze({
    firstEscalationAtIso: firstDeadline.deadlineIso,
    finalEscalationAtIso: lastDeadline.deadlineIso,
    totalSlaHours: lastDeadline.afterHours,
    stepDeadlines: Object.freeze(stepDeadlines),
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get the user who should be notified at the current escalation level.
 * Returns null if the chain has not been triggered.
 */
export function getEscalationTarget(evaluation: EscalationEvaluationV1): UserIdType | null {
  if (!evaluation.activeStep) return null;
  return evaluation.activeStep.escalateToUserId as UserIdType;
}

/**
 * Get all users who should have been notified up to the current escalation level.
 * Returns them in escalation order (first notified first).
 */
export function getAllEscalationTargets(evaluation: EscalationEvaluationV1): readonly UserIdType[] {
  if (!evaluation.isEscalated) return [];
  return evaluation.sortedChain
    .slice(0, evaluation.activeStepIndex + 1)
    .map((step) => step.escalateToUserId as UserIdType);
}

/**
 * Compute the time remaining until the next escalation step.
 * Returns null if fully escalated or not yet escalated at all with a pending first step.
 */
export function hoursUntilNextEscalation(evaluation: EscalationEvaluationV1): number | null {
  if (evaluation.fullyEscalated) return null;

  const nextIndex = evaluation.isEscalated ? evaluation.activeStepIndex + 1 : 0;
  if (nextIndex >= evaluation.totalSteps) return null;

  const nextStep = evaluation.sortedChain[nextIndex]!;
  return nextStep.afterHours - evaluation.elapsedHours;
}

/**
 * Produce a human-readable summary of the current escalation status.
 */
export function summarizeEscalation(evaluation: EscalationEvaluationV1): string {
  if (!evaluation.isEscalated) {
    const nextHours = hoursUntilNextEscalation(evaluation);
    if (nextHours !== null) {
      return `Not escalated. First escalation in ${formatHours(nextHours)}.`;
    }
    return 'Not escalated.';
  }

  const parts: string[] = [
    `Escalated to step ${String(evaluation.activeStepIndex + 1)}/${String(evaluation.totalSteps)}`,
    `target: ${evaluation.activeStep!.escalateToUserId}`,
    `elapsed: ${formatHours(evaluation.elapsedHours)}`,
  ];

  if (evaluation.fullyEscalated) {
    parts.push('(fully escalated)');
  } else {
    const nextHours = hoursUntilNextEscalation(evaluation);
    if (nextHours !== null) {
      parts.push(`next in ${formatHours(nextHours)}`);
    }
  }

  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${String(Math.round(hours * 60))}m`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${String(rounded)}h`;
}
