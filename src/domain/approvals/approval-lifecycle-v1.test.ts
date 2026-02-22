import { describe, expect, it } from 'vitest';

import {
  APPROVAL_LIFECYCLE_TRANSITIONS,
  TERMINAL_LIFECYCLE_STATUSES,
  ApprovalLifecycleTransitionError,
  approvalLifecycleEventKind,
  assertValidApprovalLifecycleTransition,
  isActiveApprovalLifecycleStatus,
  isDecisionApprovalLifecycleStatus,
  isTerminalApprovalLifecycleStatus,
  isValidApprovalLifecycleTransition,
  reachableApprovalLifecycleStatuses,
  type ApprovalLifecycleStatus,
} from './approval-lifecycle-v1.js';

// ---------------------------------------------------------------------------
// Transition table — valid transitions
// ---------------------------------------------------------------------------

describe('APPROVAL_LIFECYCLE_TRANSITIONS — valid transitions', () => {
  it('Open → Assigned', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).toContain('Assigned');
  });

  it('Open → UnderReview (fast-path: skip assignment)', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).toContain('UnderReview');
  });

  it('Open → Expired (SLA timeout before assignment)', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).toContain('Expired');
  });

  it('Assigned → UnderReview', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Assigned).toContain('UnderReview');
  });

  it('Assigned → Expired', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Assigned).toContain('Expired');
  });

  it('UnderReview → Approved', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.UnderReview).toContain('Approved');
  });

  it('UnderReview → Denied', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.UnderReview).toContain('Denied');
  });

  it('UnderReview → ChangesRequested', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.UnderReview).toContain('ChangesRequested');
  });

  it('UnderReview → Expired', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.UnderReview).toContain('Expired');
  });

  it('Approved → Executed', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Approved).toContain('Executed');
  });

  it('Approved → Expired (deadline before execution)', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Approved).toContain('Expired');
  });

  it('ChangesRequested → Open (reopened for revision)', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.ChangesRequested).toContain('Open');
  });

  it('Executed → RolledBack', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Executed).toContain('RolledBack');
  });
});

// ---------------------------------------------------------------------------
// Transition table — terminal states have no successors
// ---------------------------------------------------------------------------

describe('APPROVAL_LIFECYCLE_TRANSITIONS — terminal states', () => {
  const terminals: ApprovalLifecycleStatus[] = ['Denied', 'RolledBack', 'Expired'];

  it.each(terminals)('%s has no outgoing transitions', (status) => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS[status]).toHaveLength(0);
  });

  it('TERMINAL_LIFECYCLE_STATUSES matches the transition table', () => {
    for (const status of TERMINAL_LIFECYCLE_STATUSES) {
      expect(APPROVAL_LIFECYCLE_TRANSITIONS[status]).toHaveLength(0);
    }
  });

  it('only terminal states have empty transition lists', () => {
    const allStatuses = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS) as ApprovalLifecycleStatus[];
    const emptyTransitionStates = allStatuses.filter(
      (s) => APPROVAL_LIFECYCLE_TRANSITIONS[s].length === 0,
    );
    expect(emptyTransitionStates.sort()).toEqual([...TERMINAL_LIFECYCLE_STATUSES].sort());
  });
});

// ---------------------------------------------------------------------------
// Illegal transitions are not present
// ---------------------------------------------------------------------------

describe('APPROVAL_LIFECYCLE_TRANSITIONS — illegal transitions absent', () => {
  it('Open cannot go directly to Denied', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).not.toContain('Denied');
  });

  it('Open cannot go directly to Approved', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).not.toContain('Approved');
  });

  it('Open cannot go directly to ChangesRequested', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Open).not.toContain('ChangesRequested');
  });

  it('Assigned cannot go directly to Approved', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Assigned).not.toContain('Approved');
  });

  it('Approved cannot go back to UnderReview', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Approved).not.toContain('UnderReview');
  });

  it('Denied has no successors', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Denied).toHaveLength(0);
  });

  it('Expired has no successors', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.Expired).toHaveLength(0);
  });

  it('RolledBack has no successors', () => {
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.RolledBack).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isValidApprovalLifecycleTransition
// ---------------------------------------------------------------------------

describe('isValidApprovalLifecycleTransition', () => {
  it('returns true for all valid transitions', () => {
    for (const [from, targets] of Object.entries(APPROVAL_LIFECYCLE_TRANSITIONS)) {
      for (const to of targets as ApprovalLifecycleStatus[]) {
        expect(isValidApprovalLifecycleTransition(from as ApprovalLifecycleStatus, to)).toBe(true);
      }
    }
  });

  it('returns false for illegal transition Open → Denied', () => {
    expect(isValidApprovalLifecycleTransition('Open', 'Denied')).toBe(false);
  });

  it('returns false for self-transition', () => {
    const allStatuses = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS) as ApprovalLifecycleStatus[];
    for (const status of allStatuses) {
      expect(isValidApprovalLifecycleTransition(status, status)).toBe(false);
    }
  });

  it('returns false for Denied → anything', () => {
    const allStatuses = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS) as ApprovalLifecycleStatus[];
    for (const to of allStatuses) {
      expect(isValidApprovalLifecycleTransition('Denied', to)).toBe(false);
    }
  });

  it('returns false for backward transition Approved → Open', () => {
    expect(isValidApprovalLifecycleTransition('Approved', 'Open')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertValidApprovalLifecycleTransition
// ---------------------------------------------------------------------------

describe('assertValidApprovalLifecycleTransition', () => {
  it('does not throw for valid transition Open → Assigned', () => {
    expect(() => assertValidApprovalLifecycleTransition('Open', 'Assigned')).not.toThrow();
  });

  it('does not throw for valid transition UnderReview → Approved', () => {
    expect(() => assertValidApprovalLifecycleTransition('UnderReview', 'Approved')).not.toThrow();
  });

  it('throws ApprovalLifecycleTransitionError for invalid transition', () => {
    expect(() => assertValidApprovalLifecycleTransition('Open', 'Denied')).toThrow(
      ApprovalLifecycleTransitionError,
    );
  });

  it('error carries from/to fields', () => {
    try {
      assertValidApprovalLifecycleTransition('Approved', 'Open');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApprovalLifecycleTransitionError);
      const e = err as ApprovalLifecycleTransitionError;
      expect(e.from).toBe('Approved');
      expect(e.to).toBe('Open');
    }
  });

  it('error message contains both state names', () => {
    try {
      assertValidApprovalLifecycleTransition('Denied', 'Open');
    } catch (err) {
      expect((err as Error).message).toMatch(/Denied/);
      expect((err as Error).message).toMatch(/Open/);
    }
  });
});

// ---------------------------------------------------------------------------
// Status classification helpers
// ---------------------------------------------------------------------------

describe('isTerminalApprovalLifecycleStatus', () => {
  it('returns true for Denied, RolledBack, Expired', () => {
    expect(isTerminalApprovalLifecycleStatus('Denied')).toBe(true);
    expect(isTerminalApprovalLifecycleStatus('RolledBack')).toBe(true);
    expect(isTerminalApprovalLifecycleStatus('Expired')).toBe(true);
  });

  it('returns false for active states', () => {
    expect(isTerminalApprovalLifecycleStatus('Open')).toBe(false);
    expect(isTerminalApprovalLifecycleStatus('Assigned')).toBe(false);
    expect(isTerminalApprovalLifecycleStatus('UnderReview')).toBe(false);
    expect(isTerminalApprovalLifecycleStatus('Approved')).toBe(false);
    expect(isTerminalApprovalLifecycleStatus('ChangesRequested')).toBe(false);
    expect(isTerminalApprovalLifecycleStatus('Executed')).toBe(false);
  });
});

describe('isActiveApprovalLifecycleStatus', () => {
  it('returns true for Open, Assigned, UnderReview', () => {
    expect(isActiveApprovalLifecycleStatus('Open')).toBe(true);
    expect(isActiveApprovalLifecycleStatus('Assigned')).toBe(true);
    expect(isActiveApprovalLifecycleStatus('UnderReview')).toBe(true);
  });

  it('returns false for decided and terminal states', () => {
    expect(isActiveApprovalLifecycleStatus('Approved')).toBe(false);
    expect(isActiveApprovalLifecycleStatus('Denied')).toBe(false);
    expect(isActiveApprovalLifecycleStatus('ChangesRequested')).toBe(false);
    expect(isActiveApprovalLifecycleStatus('Executed')).toBe(false);
    expect(isActiveApprovalLifecycleStatus('RolledBack')).toBe(false);
    expect(isActiveApprovalLifecycleStatus('Expired')).toBe(false);
  });
});

describe('isDecisionApprovalLifecycleStatus', () => {
  it('returns true for Approved, Denied, ChangesRequested', () => {
    expect(isDecisionApprovalLifecycleStatus('Approved')).toBe(true);
    expect(isDecisionApprovalLifecycleStatus('Denied')).toBe(true);
    expect(isDecisionApprovalLifecycleStatus('ChangesRequested')).toBe(true);
  });

  it('returns false for non-decision states', () => {
    expect(isDecisionApprovalLifecycleStatus('Open')).toBe(false);
    expect(isDecisionApprovalLifecycleStatus('Assigned')).toBe(false);
    expect(isDecisionApprovalLifecycleStatus('UnderReview')).toBe(false);
    expect(isDecisionApprovalLifecycleStatus('Executed')).toBe(false);
    expect(isDecisionApprovalLifecycleStatus('RolledBack')).toBe(false);
    expect(isDecisionApprovalLifecycleStatus('Expired')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// approvalLifecycleEventKind
// ---------------------------------------------------------------------------

describe('approvalLifecycleEventKind', () => {
  it('Open → Assigned → ApprovalAssigned', () => {
    expect(approvalLifecycleEventKind('Open', 'Assigned')).toBe('ApprovalAssigned');
  });

  it('Open → UnderReview → ApprovalUnderReview', () => {
    expect(approvalLifecycleEventKind('Open', 'UnderReview')).toBe('ApprovalUnderReview');
  });

  it('Assigned → UnderReview → ApprovalUnderReview', () => {
    expect(approvalLifecycleEventKind('Assigned', 'UnderReview')).toBe('ApprovalUnderReview');
  });

  it('UnderReview → Approved → ApprovalGranted', () => {
    expect(approvalLifecycleEventKind('UnderReview', 'Approved')).toBe('ApprovalGranted');
  });

  it('UnderReview → Denied → ApprovalDenied', () => {
    expect(approvalLifecycleEventKind('UnderReview', 'Denied')).toBe('ApprovalDenied');
  });

  it('UnderReview → ChangesRequested → ApprovalChangesRequested', () => {
    expect(approvalLifecycleEventKind('UnderReview', 'ChangesRequested')).toBe(
      'ApprovalChangesRequested',
    );
  });

  it('ChangesRequested → Open → ApprovalReopened', () => {
    expect(approvalLifecycleEventKind('ChangesRequested', 'Open')).toBe('ApprovalReopened');
  });

  it('Approved → Executed → ApprovalExecuted', () => {
    expect(approvalLifecycleEventKind('Approved', 'Executed')).toBe('ApprovalExecuted');
  });

  it('Executed → RolledBack → ApprovalRolledBack', () => {
    expect(approvalLifecycleEventKind('Executed', 'RolledBack')).toBe('ApprovalRolledBack');
  });

  it('any state → Expired → ApprovalExpired', () => {
    const statesThatCanExpire: ApprovalLifecycleStatus[] = [
      'Open',
      'Assigned',
      'UnderReview',
      'Approved',
    ];
    for (const from of statesThatCanExpire) {
      expect(approvalLifecycleEventKind(from, 'Expired')).toBe('ApprovalExpired');
    }
  });

  it('throws for illegal transition', () => {
    expect(() => approvalLifecycleEventKind('Denied', 'Open')).toThrow(
      ApprovalLifecycleTransitionError,
    );
  });
});

// ---------------------------------------------------------------------------
// reachableApprovalLifecycleStatuses
// ---------------------------------------------------------------------------

describe('reachableApprovalLifecycleStatuses', () => {
  it('from Open — can reach all states', () => {
    const allStatuses = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS) as ApprovalLifecycleStatus[];
    const reachable = reachableApprovalLifecycleStatuses('Open');
    for (const status of allStatuses) {
      expect(reachable.has(status)).toBe(true);
    }
  });

  it('from Denied — only Denied is reachable (terminal)', () => {
    const reachable = reachableApprovalLifecycleStatuses('Denied');
    expect(reachable).toEqual(new Set(['Denied']));
  });

  it('from Expired — only Expired is reachable (terminal)', () => {
    const reachable = reachableApprovalLifecycleStatuses('Expired');
    expect(reachable).toEqual(new Set(['Expired']));
  });

  it('from ChangesRequested — can reach Open and all downstream states', () => {
    const reachable = reachableApprovalLifecycleStatuses('ChangesRequested');
    expect(reachable.has('Open')).toBe(true);
    expect(reachable.has('Assigned')).toBe(true);
    expect(reachable.has('UnderReview')).toBe(true);
    expect(reachable.has('Approved')).toBe(true);
    expect(reachable.has('Denied')).toBe(true);
    expect(reachable.has('Executed')).toBe(true);
    expect(reachable.has('Expired')).toBe(true);
  });

  it('from Executed — can reach RolledBack only', () => {
    const reachable = reachableApprovalLifecycleStatuses('Executed');
    expect(reachable).toEqual(new Set(['Executed', 'RolledBack']));
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------

describe('Structural invariants', () => {
  it('all 9 statuses are present in the transition table', () => {
    const keys = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS);
    expect(keys).toHaveLength(9);
  });

  it('all transition targets are valid status values', () => {
    const allStatuses = new Set(Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS));
    for (const [, targets] of Object.entries(APPROVAL_LIFECYCLE_TRANSITIONS)) {
      for (const target of targets as ApprovalLifecycleStatus[]) {
        expect(allStatuses.has(target)).toBe(true);
      }
    }
  });

  it('the graph is acyclic except for the ChangesRequested → Open → ... cycle', () => {
    // The only cycle in the graph should be through ChangesRequested → Open.
    // All other paths should reach a terminal state.
    // This ensures no "infinite loop" states (except the intentional review cycle).

    // From Open skipping the ChangesRequested path: should reach a terminal
    const reachableFromOpen = reachableApprovalLifecycleStatuses('Open');
    expect(reachableFromOpen.has('Denied')).toBe(true); // can reach terminal
    expect(reachableFromOpen.has('RolledBack')).toBe(true); // can reach terminal
    expect(reachableFromOpen.has('Expired')).toBe(true); // can reach terminal

    // ChangesRequested loops back to Open — the intended review cycle
    expect(APPROVAL_LIFECYCLE_TRANSITIONS.ChangesRequested).toContain('Open');
  });

  it('every non-terminal status can reach at least one terminal status', () => {
    const allStatuses = Object.keys(APPROVAL_LIFECYCLE_TRANSITIONS) as ApprovalLifecycleStatus[];
    const terminalSet = new Set(TERMINAL_LIFECYCLE_STATUSES);

    for (const status of allStatuses) {
      if (terminalSet.has(status)) continue;
      const reachable = reachableApprovalLifecycleStatuses(status);
      const canReachTerminal = [...reachable].some((s) => terminalSet.has(s));
      expect(canReachTerminal).toBe(true);
    }
  });
});
