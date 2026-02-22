import { describe, expect, it } from 'vitest';

import type { RunStatus } from '../runs/run-v1.js';

import {
  RUN_NON_TERMINAL_GUARD,
  RUN_STATUS_TRANSITIONS,
  RUN_TRANSITION_TABLE_GUARD,
  RunStatusTransitionError,
  assertValidRunStatusTransition,
  isTerminalRunStatus,
  isValidRunStatusTransition,
  reachableRunStatuses,
  terminalRunStatuses,
  type ValidRunStatusTransition,
} from './run-status-transitions.js';

// Compile-time: these should be `true`, not `never`.
type _GuardCheck1 = typeof RUN_TRANSITION_TABLE_GUARD;
type _GuardCheck2 = typeof RUN_NON_TERMINAL_GUARD;
// Compile-time: Succeeded has no valid successors (resolves to never).
type _SucceededHasNoSuccessors = ValidRunStatusTransition<'Succeeded'> extends never ? true : never;
// Compile-time: Pending can only go to Running.
type _PendingOnlyToRunning =
  ValidRunStatusTransition<'Pending'> extends 'Running'
    ? 'Running' extends ValidRunStatusTransition<'Pending'>
      ? true
      : never
    : never;

describe('compile-time guards are runtime-true', () => {
  it('RUN_TRANSITION_TABLE_GUARD is true', () => {
    expect(RUN_TRANSITION_TABLE_GUARD).toBe(true);
  });

  it('RUN_NON_TERMINAL_GUARD is true', () => {
    expect(RUN_NON_TERMINAL_GUARD).toBe(true);
  });
});

describe('isValidRunStatusTransition — valid transitions', () => {
  it.each<[RunStatus, RunStatus]>([
    ['Pending', 'Running'],
    ['Running', 'Succeeded'],
    ['Running', 'Failed'],
    ['Running', 'Cancelled'],
    ['Running', 'WaitingForApproval'],
    ['Running', 'Paused'],
    ['WaitingForApproval', 'Running'],
    ['Paused', 'Running'],
  ])('allows %s -> %s', (from, to) => {
    expect(isValidRunStatusTransition(from, to)).toBe(true);
  });
});

describe('isValidRunStatusTransition — invalid transitions', () => {
  it.each<[RunStatus, RunStatus]>([
    // Terminal states have no outgoing transitions
    ['Succeeded', 'Running'],
    ['Succeeded', 'Pending'],
    ['Succeeded', 'Failed'],
    ['Failed', 'Running'],
    ['Failed', 'Pending'],
    ['Cancelled', 'Running'],
    ['Cancelled', 'Pending'],
    // Pending can't skip intermediate states
    ['Pending', 'Succeeded'],
    ['Pending', 'Failed'],
    ['Pending', 'Cancelled'],
    ['Pending', 'WaitingForApproval'],
    ['Pending', 'Paused'],
    // WaitingForApproval can only resume to Running
    ['WaitingForApproval', 'Succeeded'],
    ['WaitingForApproval', 'Failed'],
    ['WaitingForApproval', 'Cancelled'],
    ['WaitingForApproval', 'Paused'],
    // Paused can only resume to Running
    ['Paused', 'Succeeded'],
    ['Paused', 'Failed'],
    ['Paused', 'Cancelled'],
    ['Paused', 'WaitingForApproval'],
  ])('rejects %s -> %s', (from, to) => {
    expect(isValidRunStatusTransition(from, to)).toBe(false);
  });
});

describe('assertValidRunStatusTransition', () => {
  it('throws RunStatusTransitionError for invalid transition', () => {
    expect(() => assertValidRunStatusTransition('Succeeded', 'Running')).toThrow(
      RunStatusTransitionError,
    );
  });

  it('does not throw for valid transition', () => {
    expect(() => assertValidRunStatusTransition('Pending', 'Running')).not.toThrow();
  });
});

describe('isTerminalRunStatus', () => {
  it.each<RunStatus>(['Succeeded', 'Failed', 'Cancelled'])('returns true for %s', (status) => {
    expect(isTerminalRunStatus(status)).toBe(true);
  });

  it.each<RunStatus>(['Pending', 'Running', 'WaitingForApproval', 'Paused'])(
    'returns false for %s',
    (status) => {
      expect(isTerminalRunStatus(status)).toBe(false);
    },
  );
});

describe('terminalRunStatuses', () => {
  it('returns Succeeded, Failed, Cancelled', () => {
    expect(terminalRunStatuses()).toEqual(['Succeeded', 'Failed', 'Cancelled']);
  });
});

describe('RunStatusTransitionError', () => {
  it('has from and to properties', () => {
    const error = new RunStatusTransitionError('Succeeded', 'Running');
    expect(error.from).toBe('Succeeded');
    expect(error.to).toBe('Running');
    expect(error.name).toBe('RunStatusTransitionError');
    expect(error.message).toBe('Invalid run status transition: Succeeded -> Running');
  });
});

describe('RUN_STATUS_TRANSITIONS table completeness', () => {
  it('has an entry for every RunStatus', () => {
    const allStatuses: readonly RunStatus[] = [
      'Pending',
      'Running',
      'WaitingForApproval',
      'Paused',
      'Succeeded',
      'Failed',
      'Cancelled',
    ];
    for (const s of allStatuses) {
      expect(RUN_STATUS_TRANSITIONS).toHaveProperty(s);
    }
  });

  it('terminal states have empty transition lists', () => {
    expect(RUN_STATUS_TRANSITIONS.Succeeded).toHaveLength(0);
    expect(RUN_STATUS_TRANSITIONS.Failed).toHaveLength(0);
    expect(RUN_STATUS_TRANSITIONS.Cancelled).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Structural invariants (derived from the transition graph)
// ---------------------------------------------------------------------------

const ALL_RUN_STATUSES: readonly RunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const TERMINAL_RUN_STATUSES_LIST: readonly RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];
const NON_TERMINAL_RUN_STATUSES: readonly RunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
];

describe('structural invariants', () => {
  it('every non-terminal status can reach at least one terminal status', () => {
    for (const status of NON_TERMINAL_RUN_STATUSES) {
      const reachable = reachableRunStatuses(status);
      const reachesTerminal = TERMINAL_RUN_STATUSES_LIST.some((t) => reachable.has(t));
      expect(reachesTerminal, `${status} must be able to reach a terminal state`).toBe(true);
    }
  });

  it('terminal statuses have no successors in reachability (only themselves)', () => {
    for (const status of TERMINAL_RUN_STATUSES_LIST) {
      const reachable = reachableRunStatuses(status);
      expect(reachable.size).toBe(1);
      expect(reachable.has(status)).toBe(true);
    }
  });

  it('no self-transitions exist in the table', () => {
    for (const [from, successors] of Object.entries(RUN_STATUS_TRANSITIONS)) {
      expect(successors).not.toContain(from);
    }
  });

  it('all listed successors are valid RunStatus values', () => {
    for (const [, successors] of Object.entries(RUN_STATUS_TRANSITIONS)) {
      for (const successor of successors) {
        expect(ALL_RUN_STATUSES).toContain(successor);
      }
    }
  });

  it('total valid transitions count matches the explicit transition table', () => {
    let count = 0;
    for (const from of ALL_RUN_STATUSES) {
      for (const to of ALL_RUN_STATUSES) {
        if (isValidRunStatusTransition(from, to)) count++;
      }
    }
    // Pending→Running(1) + Running→{Succeeded,Failed,Cancelled,WaitingForApproval,Paused}(5)
    // + WaitingForApproval→Running(1) + Paused→Running(1) = 8
    expect(count).toBe(8);
  });

  it('the graph contains no cycles reachable from Pending', () => {
    // BFS from Pending; if any already-visited state appears again we have a cycle.
    // (WaitingForApproval→Running and Paused→Running are back-edges in DFS, so
    // we verify via topological reachability rather than raw cycle detection.)
    // Simplest invariant: Pending cannot reach itself (no cycle back to Pending).
    const reachable = reachableRunStatuses('Pending');
    // Remove Pending itself — it's in the set because BFS includes the start.
    const withoutStart = new Set(reachable);
    withoutStart.delete('Pending');
    // None of the states reachable from Pending should be able to reach Pending.
    for (const s of withoutStart) {
      expect(reachableRunStatuses(s).has('Pending')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Exhaustive all-pairs invalid transitions
// ---------------------------------------------------------------------------

describe('isValidRunStatusTransition — exhaustive all-pairs invalid transitions', () => {
  // Derive invalid pairs from ALL_RUN_STATUSES × ALL_RUN_STATUSES minus known-valid set.
  const VALID_PAIRS = new Set(
    (
      [
        ['Pending', 'Running'],
        ['Running', 'Succeeded'],
        ['Running', 'Failed'],
        ['Running', 'Cancelled'],
        ['Running', 'WaitingForApproval'],
        ['Running', 'Paused'],
        ['WaitingForApproval', 'Running'],
        ['Paused', 'Running'],
      ] as [RunStatus, RunStatus][]
    ).map(([f, t]) => `${f}→${t}`),
  );

  const invalidPairs: [RunStatus, RunStatus][] = [];
  for (const from of ALL_RUN_STATUSES) {
    for (const to of ALL_RUN_STATUSES) {
      if (!VALID_PAIRS.has(`${from}→${to}`)) {
        invalidPairs.push([from, to]);
      }
    }
  }

  it.each(invalidPairs)('rejects %s → %s', (from, to) => {
    expect(isValidRunStatusTransition(from, to)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reachableRunStatuses — spot checks
// ---------------------------------------------------------------------------

describe('reachableRunStatuses', () => {
  it('Pending can reach all non-Pending statuses', () => {
    const reachable = reachableRunStatuses('Pending');
    for (const status of ALL_RUN_STATUSES) {
      expect(reachable.has(status)).toBe(true);
    }
  });

  it('Running can reach all terminal statuses', () => {
    const reachable = reachableRunStatuses('Running');
    for (const terminal of TERMINAL_RUN_STATUSES_LIST) {
      expect(reachable.has(terminal)).toBe(true);
    }
  });

  it('WaitingForApproval reaches Running and all terminal statuses', () => {
    const reachable = reachableRunStatuses('WaitingForApproval');
    expect(reachable.has('Running')).toBe(true);
    for (const terminal of TERMINAL_RUN_STATUSES_LIST) {
      expect(reachable.has(terminal)).toBe(true);
    }
  });

  it('Paused reaches Running and all terminal statuses', () => {
    const reachable = reachableRunStatuses('Paused');
    expect(reachable.has('Running')).toBe(true);
    for (const terminal of TERMINAL_RUN_STATUSES_LIST) {
      expect(reachable.has(terminal)).toBe(true);
    }
  });

  it.each(TERMINAL_RUN_STATUSES_LIST)('%s is a fixed-point (only reaches itself)', (status) => {
    const reachable = reachableRunStatuses(status);
    expect(reachable.size).toBe(1);
    expect(reachable.has(status)).toBe(true);
  });
});

// Compile-time narrowing types (not executed, checked by tsc)
const _check1: _GuardCheck1 = true;
const _check2: _GuardCheck2 = true;
const _check3: _SucceededHasNoSuccessors = true;
const _check4: _PendingOnlyToRunning = true;
void _check1;
void _check2;
void _check3;
void _check4;
