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

// Compile-time narrowing types (not executed, checked by tsc)
const _check1: _GuardCheck1 = true;
const _check2: _GuardCheck2 = true;
const _check3: _SucceededHasNoSuccessors = true;
const _check4: _PendingOnlyToRunning = true;
void _check1;
void _check2;
void _check3;
void _check4;
