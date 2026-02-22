/**
 * Invariant suite for the approval status state machine (bead-0759).
 *
 * Covers:
 *   - Valid transition matrix (exhaustive)
 *   - Invalid transition matrix (all illegal moves)
 *   - Terminal state invariants
 *   - Runtime guard functions
 *   - Error shape
 */

import { describe, expect, it } from 'vitest';

import type { ApprovalStatus } from '../approvals/approval-v1.js';
import {
  APPROVAL_PENDING_HAS_SUCCESSORS_GUARD,
  APPROVAL_STATUS_TRANSITIONS,
  APPROVAL_TRANSITION_TABLE_GUARD,
  ApprovalStatusTransitionError,
  TERMINAL_APPROVAL_STATUSES,
  assertValidApprovalStatusTransition,
  isTerminalApprovalStatus,
  isValidApprovalStatusTransition,
  terminalApprovalStatuses,
} from './approval-status-transitions.js';

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const ALL_STATUSES: readonly ApprovalStatus[] = [
  'Pending',
  'Approved',
  'Denied',
  'RequestChanges',
];

const TERMINAL_STATUSES: readonly ApprovalStatus[] = ['Approved', 'Denied', 'RequestChanges'];
const NON_TERMINAL_STATUSES: readonly ApprovalStatus[] = ['Pending'];

// ---------------------------------------------------------------------------
// Valid transitions (exhaustive matrix)
// ---------------------------------------------------------------------------

describe('isValidApprovalStatusTransition — valid moves', () => {
  it.each([
    ['Pending', 'Approved'],
    ['Pending', 'Denied'],
    ['Pending', 'RequestChanges'],
  ] as [ApprovalStatus, ApprovalStatus][])(
    '%s → %s is valid',
    (from, to) => {
      expect(isValidApprovalStatusTransition(from, to)).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions (all illegal moves)
// ---------------------------------------------------------------------------

describe('isValidApprovalStatusTransition — invalid moves', () => {
  // Terminal → anything
  it.each([
    ['Approved', 'Pending'],
    ['Approved', 'Denied'],
    ['Approved', 'RequestChanges'],
    ['Approved', 'Approved'],
    ['Denied', 'Pending'],
    ['Denied', 'Approved'],
    ['Denied', 'RequestChanges'],
    ['Denied', 'Denied'],
    ['RequestChanges', 'Pending'],
    ['RequestChanges', 'Approved'],
    ['RequestChanges', 'Denied'],
    ['RequestChanges', 'RequestChanges'],
    // Self-transition on Pending
    ['Pending', 'Pending'],
  ] as [ApprovalStatus, ApprovalStatus][])(
    '%s → %s is invalid',
    (from, to) => {
      expect(isValidApprovalStatusTransition(from, to)).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// assertValidApprovalStatusTransition
// ---------------------------------------------------------------------------

describe('assertValidApprovalStatusTransition', () => {
  it.each([
    ['Pending', 'Approved'],
    ['Pending', 'Denied'],
    ['Pending', 'RequestChanges'],
  ] as [ApprovalStatus, ApprovalStatus][])(
    'does not throw for valid transition %s → %s',
    (from, to) => {
      expect(() => assertValidApprovalStatusTransition(from, to)).not.toThrow();
    },
  );

  it.each([
    ['Approved', 'Pending'],
    ['Denied', 'Pending'],
    ['RequestChanges', 'Pending'],
    ['Approved', 'Approved'],
    ['Pending', 'Pending'],
  ] as [ApprovalStatus, ApprovalStatus][])(
    'throws ApprovalStatusTransitionError for invalid transition %s → %s',
    (from, to) => {
      expect(() => assertValidApprovalStatusTransition(from, to)).toThrow(
        ApprovalStatusTransitionError,
      );
    },
  );

  it('error carries from/to and readable message', () => {
    let caught: ApprovalStatusTransitionError | undefined;
    try {
      assertValidApprovalStatusTransition('Approved', 'Pending');
    } catch (e) {
      caught = e as ApprovalStatusTransitionError;
    }
    expect(caught).toBeInstanceOf(ApprovalStatusTransitionError);
    expect(caught?.from).toBe('Approved');
    expect(caught?.to).toBe('Pending');
    expect(caught?.message).toMatch(/Approved/);
    expect(caught?.message).toMatch(/Pending/);
    expect(caught?.name).toBe('ApprovalStatusTransitionError');
  });
});

// ---------------------------------------------------------------------------
// Terminal-state invariants
// ---------------------------------------------------------------------------

describe('isTerminalApprovalStatus', () => {
  it.each(TERMINAL_STATUSES)('%s is terminal', (status) => {
    expect(isTerminalApprovalStatus(status)).toBe(true);
  });

  it.each(NON_TERMINAL_STATUSES)('%s is NOT terminal', (status) => {
    expect(isTerminalApprovalStatus(status)).toBe(false);
  });
});

describe('terminalApprovalStatuses()', () => {
  it('returns the same set as TERMINAL_APPROVAL_STATUSES constant', () => {
    expect(terminalApprovalStatuses()).toEqual(TERMINAL_APPROVAL_STATUSES);
  });

  it('contains exactly Approved, Denied, RequestChanges', () => {
    const terminals = terminalApprovalStatuses();
    expect(terminals).toHaveLength(3);
    expect(terminals).toContain('Approved');
    expect(terminals).toContain('Denied');
    expect(terminals).toContain('RequestChanges');
  });
});

// ---------------------------------------------------------------------------
// APPROVAL_STATUS_TRANSITIONS table invariants
// ---------------------------------------------------------------------------

describe('APPROVAL_STATUS_TRANSITIONS table', () => {
  it('covers all statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(APPROVAL_STATUS_TRANSITIONS).toHaveProperty(status);
    }
  });

  it('Pending has exactly three successors', () => {
    expect(APPROVAL_STATUS_TRANSITIONS.Pending).toHaveLength(3);
    expect(APPROVAL_STATUS_TRANSITIONS.Pending).toContain('Approved');
    expect(APPROVAL_STATUS_TRANSITIONS.Pending).toContain('Denied');
    expect(APPROVAL_STATUS_TRANSITIONS.Pending).toContain('RequestChanges');
  });

  it.each(TERMINAL_STATUSES)('%s has no successors (terminal)', (status) => {
    expect(APPROVAL_STATUS_TRANSITIONS[status]).toHaveLength(0);
  });

  it('all listed successors are valid ApprovalStatus values', () => {
    for (const [, successors] of Object.entries(APPROVAL_STATUS_TRANSITIONS)) {
      for (const successor of successors) {
        expect(ALL_STATUSES).toContain(successor);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Structural invariants (derived from the table)
// ---------------------------------------------------------------------------

describe('structural invariants', () => {
  it('every terminal state has no outgoing transitions', () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(APPROVAL_STATUS_TRANSITIONS[terminal]).toHaveLength(0);
    }
  });

  it('every non-terminal state has at least one outgoing transition', () => {
    for (const nonTerminal of NON_TERMINAL_STATUSES) {
      expect(APPROVAL_STATUS_TRANSITIONS[nonTerminal].length).toBeGreaterThan(0);
    }
  });

  it('no self-transitions exist in the table', () => {
    for (const [from, successors] of Object.entries(APPROVAL_STATUS_TRANSITIONS)) {
      expect(successors).not.toContain(from);
    }
  });

  it('no reverse transitions from terminal back to Pending', () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(isValidApprovalStatusTransition(terminal, 'Pending')).toBe(false);
    }
  });

  it('total valid transitions == 3 (Pending→{Approved,Denied,RequestChanges})', () => {
    let count = 0;
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (isValidApprovalStatusTransition(from, to)) count++;
      }
    }
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Compile-time guard values (runtime check that guards resolve to `true`)
// ---------------------------------------------------------------------------

describe('compile-time guards', () => {
  it('APPROVAL_TRANSITION_TABLE_GUARD is true', () => {
    expect(APPROVAL_TRANSITION_TABLE_GUARD).toBe(true);
  });

  it('APPROVAL_PENDING_HAS_SUCCESSORS_GUARD is true', () => {
    expect(APPROVAL_PENDING_HAS_SUCCESSORS_GUARD).toBe(true);
  });
});
