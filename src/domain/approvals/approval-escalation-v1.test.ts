import { describe, expect, it } from 'vitest';

import {
  computeEscalationSla,
  EscalationValidationError,
  evaluateEscalation,
  getAllEscalationTargets,
  getEscalationTarget,
  hoursUntilNextEscalation,
  sortEscalationChain,
  summarizeEscalation,
  type EscalationStepInput,
} from './approval-escalation-v1.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const chain: readonly EscalationStepInput[] = [
  { stepOrder: 1, escalateToUserId: 'user-lead', afterHours: 4 },
  { stepOrder: 2, escalateToUserId: 'user-manager', afterHours: 8 },
  { stepOrder: 3, escalateToUserId: 'user-director', afterHours: 24 },
];

const requestedAt = '2026-01-15T10:00:00Z';

// ---------------------------------------------------------------------------
// sortEscalationChain
// ---------------------------------------------------------------------------

describe('sortEscalationChain', () => {
  it('sorts by afterHours ascending', () => {
    const unsorted: EscalationStepInput[] = [
      { stepOrder: 3, escalateToUserId: 'c', afterHours: 24 },
      { stepOrder: 1, escalateToUserId: 'a', afterHours: 4 },
      { stepOrder: 2, escalateToUserId: 'b', afterHours: 8 },
    ];
    const sorted = sortEscalationChain(unsorted);
    expect(sorted[0]!.afterHours).toBe(4);
    expect(sorted[1]!.afterHours).toBe(8);
    expect(sorted[2]!.afterHours).toBe(24);
  });

  it('breaks ties by stepOrder', () => {
    const tied: EscalationStepInput[] = [
      { stepOrder: 2, escalateToUserId: 'b', afterHours: 4 },
      { stepOrder: 1, escalateToUserId: 'a', afterHours: 4 },
    ];
    const sorted = sortEscalationChain(tied);
    expect(sorted[0]!.stepOrder).toBe(1);
    expect(sorted[1]!.stepOrder).toBe(2);
  });

  it('does not mutate the original array', () => {
    const original: EscalationStepInput[] = [
      { stepOrder: 2, escalateToUserId: 'b', afterHours: 8 },
      { stepOrder: 1, escalateToUserId: 'a', afterHours: 4 },
    ];
    sortEscalationChain(original);
    expect(original[0]!.stepOrder).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// evaluateEscalation
// ---------------------------------------------------------------------------

describe('evaluateEscalation', () => {
  it('throws for empty chain', () => {
    expect(() => evaluateEscalation([], requestedAt, '2026-01-15T12:00:00Z')).toThrow(
      EscalationValidationError,
    );
  });

  it('returns not escalated before first step', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-15T12:00:00Z'); // 2h elapsed
    expect(result.isEscalated).toBe(false);
    expect(result.activeStep).toBeNull();
    expect(result.activeStepIndex).toBe(-1);
    expect(result.fullyEscalated).toBe(false);
    expect(result.elapsedHours).toBeCloseTo(2, 5);
  });

  it('triggers first step at exact boundary', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-15T14:00:00Z'); // 4h
    expect(result.isEscalated).toBe(true);
    expect(result.activeStep!.escalateToUserId).toBe('user-lead');
    expect(result.activeStepIndex).toBe(0);
    expect(result.fullyEscalated).toBe(false);
  });

  it('triggers second step between step 2 and 3', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-15T20:00:00Z'); // 10h
    expect(result.isEscalated).toBe(true);
    expect(result.activeStep!.escalateToUserId).toBe('user-manager');
    expect(result.activeStepIndex).toBe(1);
    expect(result.fullyEscalated).toBe(false);
  });

  it('triggers final step and marks fully escalated', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-16T10:00:00Z'); // 24h
    expect(result.isEscalated).toBe(true);
    expect(result.activeStep!.escalateToUserId).toBe('user-director');
    expect(result.activeStepIndex).toBe(2);
    expect(result.fullyEscalated).toBe(true);
  });

  it('remains fully escalated well after final step', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-20T10:00:00Z'); // 120h
    expect(result.fullyEscalated).toBe(true);
    expect(result.elapsedHours).toBeCloseTo(120, 5);
  });

  it('returns frozen result', () => {
    const result = evaluateEscalation(chain, requestedAt, '2026-01-15T14:00:00Z');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.sortedChain)).toBe(true);
  });

  it('handles single-step chain', () => {
    const singleStep: EscalationStepInput[] = [
      { stepOrder: 1, escalateToUserId: 'user-lead', afterHours: 2 },
    ];
    const notYet = evaluateEscalation(singleStep, requestedAt, '2026-01-15T11:00:00Z');
    expect(notYet.isEscalated).toBe(false);

    const triggered = evaluateEscalation(singleStep, requestedAt, '2026-01-15T12:00:00Z');
    expect(triggered.isEscalated).toBe(true);
    expect(triggered.fullyEscalated).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeEscalationSla
// ---------------------------------------------------------------------------

describe('computeEscalationSla', () => {
  it('throws for empty chain', () => {
    expect(() => computeEscalationSla([], requestedAt)).toThrow(EscalationValidationError);
  });

  it('computes correct deadlines', () => {
    const sla = computeEscalationSla(chain, requestedAt);

    expect(sla.firstEscalationAtIso).toBe('2026-01-15T14:00:00.000Z');
    expect(sla.finalEscalationAtIso).toBe('2026-01-16T10:00:00.000Z');
    expect(sla.totalSlaHours).toBe(24);
    expect(sla.stepDeadlines).toHaveLength(3);
  });

  it('computes per-step deadlines in order', () => {
    const sla = computeEscalationSla(chain, requestedAt);

    expect(sla.stepDeadlines[0]!.deadlineIso).toBe('2026-01-15T14:00:00.000Z');
    expect(sla.stepDeadlines[0]!.escalateToUserId).toBe('user-lead');
    expect(sla.stepDeadlines[1]!.deadlineIso).toBe('2026-01-15T18:00:00.000Z');
    expect(sla.stepDeadlines[1]!.escalateToUserId).toBe('user-manager');
    expect(sla.stepDeadlines[2]!.deadlineIso).toBe('2026-01-16T10:00:00.000Z');
    expect(sla.stepDeadlines[2]!.escalateToUserId).toBe('user-director');
  });

  it('returns frozen result', () => {
    const sla = computeEscalationSla(chain, requestedAt);
    expect(Object.isFrozen(sla)).toBe(true);
    expect(Object.isFrozen(sla.stepDeadlines)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getEscalationTarget
// ---------------------------------------------------------------------------

describe('getEscalationTarget', () => {
  it('returns null when not escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T12:00:00Z');
    expect(getEscalationTarget(evaluation)).toBeNull();
  });

  it('returns the active step user when escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T14:00:00Z');
    expect(getEscalationTarget(evaluation)).toBe('user-lead');
  });
});

// ---------------------------------------------------------------------------
// getAllEscalationTargets
// ---------------------------------------------------------------------------

describe('getAllEscalationTargets', () => {
  it('returns empty when not escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T12:00:00Z');
    expect(getAllEscalationTargets(evaluation)).toEqual([]);
  });

  it('returns all targets up to current step', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T20:00:00Z'); // step 2
    const targets = getAllEscalationTargets(evaluation);
    expect(targets).toEqual(['user-lead', 'user-manager']);
  });

  it('returns all targets when fully escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-16T10:00:00Z');
    const targets = getAllEscalationTargets(evaluation);
    expect(targets).toEqual(['user-lead', 'user-manager', 'user-director']);
  });
});

// ---------------------------------------------------------------------------
// hoursUntilNextEscalation
// ---------------------------------------------------------------------------

describe('hoursUntilNextEscalation', () => {
  it('returns hours until first step when not escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T12:00:00Z'); // 2h elapsed
    expect(hoursUntilNextEscalation(evaluation)).toBeCloseTo(2, 5);
  });

  it('returns hours until next step when partially escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T15:00:00Z'); // 5h, step 1 active
    expect(hoursUntilNextEscalation(evaluation)).toBeCloseTo(3, 5); // 8h - 5h = 3h
  });

  it('returns null when fully escalated', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-16T10:00:00Z');
    expect(hoursUntilNextEscalation(evaluation)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// summarizeEscalation
// ---------------------------------------------------------------------------

describe('summarizeEscalation', () => {
  it('summarizes non-escalated state', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T12:00:00Z');
    const summary = summarizeEscalation(evaluation);
    expect(summary).toContain('Not escalated');
    expect(summary).toContain('2h');
  });

  it('summarizes partially escalated state', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T15:00:00Z');
    const summary = summarizeEscalation(evaluation);
    expect(summary).toContain('step 1/3');
    expect(summary).toContain('user-lead');
    expect(summary).toContain('next in');
  });

  it('summarizes fully escalated state', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-16T10:00:00Z');
    const summary = summarizeEscalation(evaluation);
    expect(summary).toContain('step 3/3');
    expect(summary).toContain('fully escalated');
  });

  it('formats sub-hour durations as minutes', () => {
    const evaluation = evaluateEscalation(chain, requestedAt, '2026-01-15T13:30:00Z'); // 3.5h, 30m to first
    const summary = summarizeEscalation(evaluation);
    expect(summary).toContain('30m');
  });
});
