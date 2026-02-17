import { describe, expect, it } from 'vitest';

import type { RunStatus } from '../runs/run-v1.js';

import {
  RunStatusTransitionError,
  assertValidRunStatusTransition,
  isTerminalRunStatus,
  isValidRunStatusTransition,
  terminalRunStatuses,
} from './run-status-transitions.js';

describe('isValidRunStatusTransition', () => {
  it('allows Pending -> Running', () => {
    expect(isValidRunStatusTransition('Pending', 'Running')).toBe(true);
  });

  it('allows Running -> Succeeded', () => {
    expect(isValidRunStatusTransition('Running', 'Succeeded')).toBe(true);
  });

  it('allows Running -> Failed', () => {
    expect(isValidRunStatusTransition('Running', 'Failed')).toBe(true);
  });

  it('allows Running -> Cancelled', () => {
    expect(isValidRunStatusTransition('Running', 'Cancelled')).toBe(true);
  });

  it('allows Running -> WaitingForApproval', () => {
    expect(isValidRunStatusTransition('Running', 'WaitingForApproval')).toBe(true);
  });

  it('allows Running -> Paused', () => {
    expect(isValidRunStatusTransition('Running', 'Paused')).toBe(true);
  });

  it('allows WaitingForApproval -> Running', () => {
    expect(isValidRunStatusTransition('WaitingForApproval', 'Running')).toBe(true);
  });

  it('allows Paused -> Running', () => {
    expect(isValidRunStatusTransition('Paused', 'Running')).toBe(true);
  });

  it('rejects Pending -> Succeeded (skip)', () => {
    expect(isValidRunStatusTransition('Pending', 'Succeeded')).toBe(false);
  });

  it('rejects Succeeded -> Running (terminal)', () => {
    expect(isValidRunStatusTransition('Succeeded', 'Running')).toBe(false);
  });

  it('rejects Failed -> Running (terminal)', () => {
    expect(isValidRunStatusTransition('Failed', 'Running')).toBe(false);
  });

  it('rejects Cancelled -> Running (terminal)', () => {
    expect(isValidRunStatusTransition('Cancelled', 'Running')).toBe(false);
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
