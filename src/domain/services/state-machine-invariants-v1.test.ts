/**
 * Domain V&V: State-machine invariant suite (bead-0759).
 *
 * Systematic property-based verification of all domain state machines:
 *
 *   1. Run status transitions  (run-status-transitions.ts)
 *   2. Approval status         (approval-v1.ts — simpler 2-state machine)
 *
 * Strategy:
 *   - Generate the full cross-product of (from, to) state pairs and check
 *     each pair against the canonical transition table.
 *   - Assert structural invariants (terminal states / reachability /
 *     determinism) that must hold for ANY correctly-defined state machine.
 *   - Keep each assertion atomic so mutation survivors are immediately
 *     obvious (each test kills a different mutant class).
 */

import { describe, expect, it } from 'vitest';

import type { RunStatus } from '../runs/run-v1.js';

import {
  APPROVAL_STATUS_TRANSITIONS,
  TERMINAL_APPROVAL_STATUSES,
  assertValidApprovalStatusTransition,
  isTerminalApprovalStatus,
  isValidApprovalStatusTransition,
  terminalApprovalStatuses,
} from './approval-status-transitions.js';
import {
  RUN_STATUS_TRANSITIONS,
  assertValidRunStatusTransition,
  isTerminalRunStatus,
  isValidRunStatusTransition,
  terminalRunStatuses,
} from './run-status-transitions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All run statuses derived at runtime from the canonical table. */
const ALL_RUN_STATUSES: readonly RunStatus[] = Object.keys(RUN_STATUS_TRANSITIONS) as RunStatus[];

const ALL_RUN_PAIRS: ReadonlyArray<readonly [RunStatus, RunStatus]> = ALL_RUN_STATUSES.flatMap(
  (from) => ALL_RUN_STATUSES.map((to) => [from, to] as const),
);

/** Compute reachable states via BFS from an initial state. */
function reachableFrom(
  initial: RunStatus,
  table: Readonly<Record<RunStatus, readonly RunStatus[]>>,
): Set<RunStatus> {
  const visited = new Set<RunStatus>([initial]);
  const queue: RunStatus[] = [initial];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of table[current]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

// ---------------------------------------------------------------------------
// I. Run status machine — exhaustive cross-product
// ---------------------------------------------------------------------------

describe('Run status state machine — full cross-product', () => {
  it('every valid pair passes isValidRunStatusTransition', () => {
    for (const from of ALL_RUN_STATUSES) {
      const validTargets = new Set(RUN_STATUS_TRANSITIONS[from]);
      for (const to of ALL_RUN_STATUSES) {
        const expected = validTargets.has(to);
        expect(isValidRunStatusTransition(from, to)).toBe(expected);
      }
    }
  });

  it('isValidRunStatusTransition returns false for self-loops on ALL states', () => {
    for (const status of ALL_RUN_STATUSES) {
      expect(isValidRunStatusTransition(status, status)).toBe(false);
    }
  });

  it.each(ALL_RUN_PAIRS)(
    'isValidRunStatusTransition(%s, %s) agrees with RUN_STATUS_TRANSITIONS',
    (from, to) => {
      const tableAllows = RUN_STATUS_TRANSITIONS[from].includes(to);
      expect(isValidRunStatusTransition(from, to)).toBe(tableAllows);
    },
  );
});

// ---------------------------------------------------------------------------
// II. Run status machine — structural invariants
// ---------------------------------------------------------------------------

describe('Run status machine — structural invariants', () => {
  it('every terminal state has zero outgoing transitions', () => {
    for (const terminal of terminalRunStatuses()) {
      expect(RUN_STATUS_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });

  it('every non-terminal state has at least one outgoing transition', () => {
    const terminals = new Set(terminalRunStatuses());
    for (const status of ALL_RUN_STATUSES) {
      if (!terminals.has(status)) {
        expect(RUN_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
      }
    }
  });

  it('isTerminalRunStatus is consistent with terminalRunStatuses()', () => {
    const terminalSet = new Set(terminalRunStatuses());
    for (const status of ALL_RUN_STATUSES) {
      expect(isTerminalRunStatus(status)).toBe(terminalSet.has(status));
    }
  });

  it('transition targets are always valid RunStatus values', () => {
    const validSet = new Set(ALL_RUN_STATUSES);
    for (const from of ALL_RUN_STATUSES) {
      for (const to of RUN_STATUS_TRANSITIONS[from]) {
        expect(validSet.has(to)).toBe(true);
      }
    }
  });

  it('transitions are deterministic — same (from, to) always yields same result', () => {
    for (const [from, to] of ALL_RUN_PAIRS) {
      const r1 = isValidRunStatusTransition(from, to);
      const r2 = isValidRunStatusTransition(from, to);
      expect(r1).toBe(r2);
    }
  });

  it('no duplicate targets in any transition list', () => {
    for (const from of ALL_RUN_STATUSES) {
      const targets = RUN_STATUS_TRANSITIONS[from];
      const unique = new Set(targets);
      expect(unique.size).toBe(targets.length);
    }
  });
});

// ---------------------------------------------------------------------------
// III. Run status machine — reachability
// ---------------------------------------------------------------------------

describe('Run status machine — reachability from Pending', () => {
  const reachable = reachableFrom('Pending', RUN_STATUS_TRANSITIONS);

  it('all RunStatus values are reachable from Pending', () => {
    for (const status of ALL_RUN_STATUSES) {
      expect(reachable.has(status)).toBe(true);
    }
  });

  it('Pending is reachable (trivially — it is the root)', () => {
    expect(reachable.has('Pending')).toBe(true);
  });

  it('all terminal states are reachable', () => {
    for (const terminal of terminalRunStatuses()) {
      expect(reachable.has(terminal)).toBe(true);
    }
  });

  it('no state appears in its own forward-reachability set (no cycles to Pending)', () => {
    // From Pending there should be no way to return to Pending.
    const fromRunning = reachableFrom('Running', RUN_STATUS_TRANSITIONS);
    expect(fromRunning.has('Pending')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IV. assertValidRunStatusTransition — error semantics
// ---------------------------------------------------------------------------

describe('assertValidRunStatusTransition — error semantics', () => {
  it('throws RunStatusTransitionError for every invalid transition', () => {
    for (const from of ALL_RUN_STATUSES) {
      const validTargets = new Set(RUN_STATUS_TRANSITIONS[from]);
      const invalidTargets = ALL_RUN_STATUSES.filter((to) => !validTargets.has(to));

      for (const to of invalidTargets) {
        expect(() => assertValidRunStatusTransition(from, to)).toThrow();
      }
    }
  });

  it('does NOT throw for every valid transition', () => {
    for (const from of ALL_RUN_STATUSES) {
      for (const to of RUN_STATUS_TRANSITIONS[from]) {
        expect(() => assertValidRunStatusTransition(from, to)).not.toThrow();
      }
    }
  });

  it('error message contains both the from and to states', () => {
    try {
      assertValidRunStatusTransition('Succeeded', 'Running');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain('Succeeded');
      expect(msg).toContain('Running');
    }
  });

  it('throws for terminal → terminal invalid path', () => {
    expect(() => assertValidRunStatusTransition('Succeeded', 'Failed')).toThrow();
    expect(() => assertValidRunStatusTransition('Failed', 'Cancelled')).toThrow();
    expect(() => assertValidRunStatusTransition('Cancelled', 'Succeeded')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// V. Approval state machine — invariants
// ---------------------------------------------------------------------------

/**
 * The approval state machine has Pending as the only non-terminal state;
 * Approved, Denied, RequestChanges are terminal.
 *
 * Uses the canonical implementation from approval-status-transitions.ts.
 */

import type { ApprovalStatus } from '../approvals/approval-v1.js';

const APPROVAL_STATUSES: readonly ApprovalStatus[] = Object.keys(
  APPROVAL_STATUS_TRANSITIONS,
) as ApprovalStatus[];

const ALL_APPROVAL_PAIRS: ReadonlyArray<readonly [ApprovalStatus, ApprovalStatus]> =
  APPROVAL_STATUSES.flatMap((from) => APPROVAL_STATUSES.map((to) => [from, to] as const));

describe('Approval state machine — structural invariants', () => {
  it('only Pending has outgoing transitions', () => {
    for (const status of APPROVAL_STATUSES) {
      if (status === 'Pending') {
        expect(APPROVAL_STATUS_TRANSITIONS[status].length).toBeGreaterThan(0);
      } else {
        expect(APPROVAL_STATUS_TRANSITIONS[status]).toHaveLength(0);
      }
    }
  });

  it('all terminal approval states have zero transitions', () => {
    for (const terminal of TERMINAL_APPROVAL_STATUSES) {
      expect(APPROVAL_STATUS_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });

  it('Pending can reach all decision states', () => {
    const decisions: ApprovalStatus[] = ['Approved', 'Denied', 'RequestChanges'];
    for (const decision of decisions) {
      expect(APPROVAL_STATUS_TRANSITIONS['Pending']).toContain(decision);
    }
  });

  it('Pending cannot transition to itself', () => {
    expect(APPROVAL_STATUS_TRANSITIONS['Pending']).not.toContain('Pending');
  });

  it('no terminal approval state can transition to Pending', () => {
    for (const terminal of TERMINAL_APPROVAL_STATUSES) {
      expect(APPROVAL_STATUS_TRANSITIONS[terminal]).not.toContain('Pending');
    }
  });

  it('isValidApprovalStatusTransition is consistent with transition table for all pairs', () => {
    for (const [from, to] of ALL_APPROVAL_PAIRS) {
      const tableAllows = APPROVAL_STATUS_TRANSITIONS[from].includes(to);
      expect(isValidApprovalStatusTransition(from, to)).toBe(tableAllows);
      // Structural invariants:
      if (from === to) expect(isValidApprovalStatusTransition(from, to)).toBe(false);
      if (TERMINAL_APPROVAL_STATUSES.includes(from)) {
        expect(isValidApprovalStatusTransition(from, to)).toBe(false);
      }
    }
  });

  it('assertValidApprovalStatusTransition throws for every invalid pair', () => {
    for (const [from, to] of ALL_APPROVAL_PAIRS) {
      const allowed = APPROVAL_STATUS_TRANSITIONS[from].includes(to);
      if (!allowed) {
        expect(() => assertValidApprovalStatusTransition(from, to)).toThrow();
      } else {
        expect(() => assertValidApprovalStatusTransition(from, to)).not.toThrow();
      }
    }
  });

  it('isTerminalApprovalStatus agrees with terminalApprovalStatuses()', () => {
    const terminalSet = new Set(terminalApprovalStatuses());
    for (const status of APPROVAL_STATUSES) {
      expect(isTerminalApprovalStatus(status)).toBe(terminalSet.has(status));
    }
  });
});

describe('Approval state machine — reachability', () => {
  it('all decision states are reachable from Pending', () => {
    const reachable = reachableFrom(
      'Pending',
      APPROVAL_STATUS_TRANSITIONS as unknown as Record<RunStatus, readonly RunStatus[]>,
    );
    for (const decision of TERMINAL_APPROVAL_STATUSES) {
      expect(reachable.has(decision as unknown as RunStatus)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// VI. Mutation-sensitive property tests
//     Each test targets a specific mutant class (boundary, sign, logical operator)
// ---------------------------------------------------------------------------

describe('Mutation-targeted boundary tests', () => {
  it('Pending → Running is the ONLY transition from Pending', () => {
    expect(RUN_STATUS_TRANSITIONS['Pending']).toEqual(['Running']);
    expect(RUN_STATUS_TRANSITIONS['Pending']).toHaveLength(1);
  });

  it('Running has exactly 5 valid successor states', () => {
    expect(RUN_STATUS_TRANSITIONS['Running']).toHaveLength(5);
  });

  it('WaitingForApproval → Running is the ONLY transition from WaitingForApproval', () => {
    expect(RUN_STATUS_TRANSITIONS['WaitingForApproval']).toEqual(['Running']);
    expect(RUN_STATUS_TRANSITIONS['WaitingForApproval']).toHaveLength(1);
  });

  it('Paused → Running is the ONLY transition from Paused', () => {
    expect(RUN_STATUS_TRANSITIONS['Paused']).toEqual(['Running']);
    expect(RUN_STATUS_TRANSITIONS['Paused']).toHaveLength(1);
  });

  it('exactly 3 terminal run statuses (Succeeded, Failed, Cancelled)', () => {
    expect(terminalRunStatuses()).toHaveLength(3);
    expect(terminalRunStatuses()).toContain('Succeeded');
    expect(terminalRunStatuses()).toContain('Failed');
    expect(terminalRunStatuses()).toContain('Cancelled');
  });

  it('exactly 4 non-terminal run statuses', () => {
    const terminals = new Set(terminalRunStatuses());
    const nonTerminals = ALL_RUN_STATUSES.filter((s) => !terminals.has(s));
    expect(nonTerminals).toHaveLength(4);
  });

  it('Running → WaitingForApproval is valid (not vice-versa-only)', () => {
    expect(isValidRunStatusTransition('Running', 'WaitingForApproval')).toBe(true);
    expect(isValidRunStatusTransition('WaitingForApproval', 'Running')).toBe(true);
    // But WaitingForApproval cannot bypass Running to reach terminal states
    expect(isValidRunStatusTransition('WaitingForApproval', 'Succeeded')).toBe(false);
    expect(isValidRunStatusTransition('WaitingForApproval', 'Failed')).toBe(false);
    expect(isValidRunStatusTransition('WaitingForApproval', 'Cancelled')).toBe(false);
  });

  it('isTerminalRunStatus returns false for all 4 non-terminal states', () => {
    const nonTerminals: RunStatus[] = ['Pending', 'Running', 'WaitingForApproval', 'Paused'];
    for (const s of nonTerminals) {
      expect(isTerminalRunStatus(s)).toBe(false);
    }
  });

  it('isTerminalRunStatus returns true for all 3 terminal states', () => {
    for (const terminal of terminalRunStatuses()) {
      expect(isTerminalRunStatus(terminal)).toBe(true);
    }
  });

  it('Running cannot self-loop (Running → Running is invalid)', () => {
    expect(isValidRunStatusTransition('Running', 'Running')).toBe(false);
  });

  it('Pending cannot skip to WaitingForApproval without Running first', () => {
    expect(isValidRunStatusTransition('Pending', 'WaitingForApproval')).toBe(false);
  });

  it('total run transition edge count is exactly 8', () => {
    const totalEdges = ALL_RUN_STATUSES.reduce(
      (sum, from) => sum + RUN_STATUS_TRANSITIONS[from].length,
      0,
    );
    // Pending(1) + Running(5) + WaitingForApproval(1) + Paused(1) + terminals(0)
    expect(totalEdges).toBe(8);
  });
});
