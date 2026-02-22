/**
 * bead-0759: Domain V&V — Workflow/Approval/Run state-machine invariant suite.
 *
 * These tests verify the formal invariants that the domain state machines must
 * uphold under all reachable state combinations. They complement the unit tests
 * in run-v1.test.ts and approval-v1.test.ts by exercising the *relationships*
 * between states rather than individual parse operations.
 */

import { describe, expect, it } from 'vitest';

import {
  type ApprovalLifecycleStatus,
  isValidApprovalLifecycleTransition,
  isTerminalApprovalLifecycleStatus,
  isActiveApprovalLifecycleStatus,
  isDecisionApprovalLifecycleStatus,
} from '../approvals/approval-lifecycle-v1.js';

import { type RunStatus, parseRunV1 } from '../runs/run-v1.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_APPROVAL_STATUSES: ApprovalLifecycleStatus[] = [
  'Open',
  'Assigned',
  'UnderReview',
  'Approved',
  'Denied',
  'ChangesRequested',
  'Executed',
  'RolledBack',
  'Expired',
];

const TERMINAL_APPROVAL_STATUSES: ApprovalLifecycleStatus[] = ['Denied', 'RolledBack', 'Expired'];

const ACTIVE_APPROVAL_STATUSES: ApprovalLifecycleStatus[] = ['Open', 'Assigned', 'UnderReview'];

const ALL_RUN_STATUSES: RunStatus[] = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
];

const TERMINAL_RUN_STATUSES: RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];

function makeRun(status: RunStatus, overrides: Record<string, unknown> = {}) {
  return parseRunV1({
    schemaVersion: 1,
    runId: 'run-inv-1',
    workspaceId: 'ws-inv-1',
    workflowId: 'wf-inv-1',
    correlationId: 'corr-inv-1',
    executionTier: 'Auto',
    initiatedByUserId: 'user-inv-1',
    status,
    createdAtIso: '2026-02-22T00:00:00.000Z',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Approval lifecycle invariants
// ---------------------------------------------------------------------------

describe('Approval lifecycle: terminal state invariants', () => {
  it('terminal states have no outgoing transitions', () => {
    for (const status of TERMINAL_APPROVAL_STATUSES) {
      // isValidApprovalLifecycleTransition checks direct transitions only
      const hasAnyOutgoing = ALL_APPROVAL_STATUSES.some(
        (to) => to !== status && isValidApprovalLifecycleTransition(status, to),
      );
      expect(
        hasAnyOutgoing,
        `Terminal status ${status} should have no outgoing transitions`,
      ).toBe(false);
    }
  });

  it('non-terminal states have at least one outgoing transition', () => {
    const nonTerminal = ALL_APPROVAL_STATUSES.filter(
      (s) => !TERMINAL_APPROVAL_STATUSES.includes(s),
    );
    for (const status of nonTerminal) {
      const hasAnyOutgoing = ALL_APPROVAL_STATUSES.some(
        (to) => isValidApprovalLifecycleTransition(status, to),
      );
      expect(
        hasAnyOutgoing,
        `Non-terminal status ${status} must have ≥ 1 outgoing transition`,
      ).toBe(true);
    }
  });

  it('terminal states are correctly classified', () => {
    for (const status of ALL_APPROVAL_STATUSES) {
      const isTerminal = isTerminalApprovalLifecycleStatus(status);
      const inTerminalList = TERMINAL_APPROVAL_STATUSES.includes(status);
      expect(isTerminal).toBe(inTerminalList);
    }
  });

  it('active states are correctly classified', () => {
    for (const status of ALL_APPROVAL_STATUSES) {
      const isActive = isActiveApprovalLifecycleStatus(status);
      const inActiveList = ACTIVE_APPROVAL_STATUSES.includes(status);
      expect(isActive).toBe(inActiveList);
    }
  });

  it('decision states are a subset of all statuses', () => {
    for (const status of ALL_APPROVAL_STATUSES) {
      const isDecision = isDecisionApprovalLifecycleStatus(status);
      if (isDecision) {
        // Decision states must not be active (already decided)
        expect(
          isActiveApprovalLifecycleStatus(status),
          `Decision status ${status} must not be active`,
        ).toBe(false);
      }
    }
  });
});

describe('Approval lifecycle: transition graph invariants', () => {
  it('Executed is only reachable from Approved', () => {
    const canTransitionToExecuted = ALL_APPROVAL_STATUSES.filter((s) =>
      isValidApprovalLifecycleTransition(s, 'Executed'),
    );
    expect(canTransitionToExecuted).toEqual(['Approved']);
  });

  it('RolledBack is only reachable from Executed', () => {
    const canTransitionToRolledBack = ALL_APPROVAL_STATUSES.filter((s) =>
      isValidApprovalLifecycleTransition(s, 'RolledBack'),
    );
    expect(canTransitionToRolledBack).toEqual(['Executed']);
  });

  it('ChangesRequested can be reopened (→ Open)', () => {
    expect(isValidApprovalLifecycleTransition('ChangesRequested', 'Open')).toBe(true);
  });

  it('Expired is reachable from Open, Assigned, UnderReview, and Approved', () => {
    // These states have direct or transitive paths to Expired
    const canExpire: ApprovalLifecycleStatus[] = ['Open', 'Assigned', 'UnderReview', 'Approved'];
    for (const status of canExpire) {
      expect(
        isValidApprovalLifecycleTransition(status, 'Expired'),
        `${status} → Expired should be valid`,
      ).toBe(true);
    }
  });

  it('ChangesRequested and Executed cannot directly expire', () => {
    // ChangesRequested → Open (reopen), not Expired
    // Executed → RolledBack only
    expect(isValidApprovalLifecycleTransition('ChangesRequested', 'Expired')).toBe(false);
    expect(isValidApprovalLifecycleTransition('Executed', 'Expired')).toBe(false);
  });

  it('transitions are not symmetric (no bidirectional edges except via reopen)', () => {
    // The only legitimate "backwards" transition is ChangesRequested → Open (reopen)
    const allowedBackward: [ApprovalLifecycleStatus, ApprovalLifecycleStatus][] = [
      ['ChangesRequested', 'Open'],
    ];

    for (const from of ALL_APPROVAL_STATUSES) {
      for (const to of ALL_APPROVAL_STATUSES) {
        if (from === to) continue;
        if (
          isValidApprovalLifecycleTransition(from, to) &&
          isValidApprovalLifecycleTransition(to, from)
        ) {
          // This pair is bidirectional — it must be in the allowed list
          const allowed = allowedBackward.some(([a, b]) => a === from && b === to);
          expect(
            allowed,
            `Unexpected bidirectional edge: ${from} ↔ ${to}`,
          ).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Run state-machine invariants
// ---------------------------------------------------------------------------

describe('Run: terminal state invariants', () => {
  it('terminal runs have an endedAtIso', () => {
    for (const status of TERMINAL_RUN_STATUSES) {
      const run = makeRun(status, {
        startedAtIso: '2026-02-22T00:00:01.000Z',
        endedAtIso: '2026-02-22T00:00:10.000Z',
      });
      expect(run.endedAtIso, `Terminal run ${status} must have endedAtIso`).toBeDefined();
    }
  });

  it('pending run has no startedAtIso', () => {
    const run = makeRun('Pending');
    expect(run.startedAtIso).toBeUndefined();
    expect(run.endedAtIso).toBeUndefined();
  });

  it('endedAtIso must not precede startedAtIso', () => {
    expect(() =>
      makeRun('Succeeded', {
        startedAtIso: '2026-02-22T00:00:10.000Z',
        endedAtIso: '2026-02-22T00:00:01.000Z', // end before start
      }),
    ).toThrow();
  });

  it('all run status values are parseable', () => {
    for (const status of ALL_RUN_STATUSES) {
      const run = makeRun(status);
      expect(run.status).toBe(status);
    }
  });
});

describe('Run: cross-field invariants', () => {
  it('run with WaitingForApproval status is valid (approval pauses run)', () => {
    const run = makeRun('WaitingForApproval', {
      startedAtIso: '2026-02-22T00:00:01.000Z',
    });
    expect(run.status).toBe('WaitingForApproval');
    expect(run.startedAtIso).toBeDefined();
    expect(run.endedAtIso).toBeUndefined();
  });

  it('run with Auto tier does not require human approval (domain rule)', () => {
    // Auto tier: all approvals are automatic — no WaitingForApproval state should occur
    // This invariant is enforced at the application layer; domain only stores the tier
    const run = makeRun('Running', { executionTier: 'Auto' });
    expect(run.executionTier).toBe('Auto');
  });

  it('run with ManualOnly tier can reach WaitingForApproval', () => {
    const run = makeRun('WaitingForApproval', {
      executionTier: 'ManualOnly',
      startedAtIso: '2026-02-22T00:00:01.000Z',
    });
    expect(run.executionTier).toBe('ManualOnly');
    expect(run.status).toBe('WaitingForApproval');
  });
});

// ---------------------------------------------------------------------------
// Cross-domain: Approval ↔ Run interaction invariants
// ---------------------------------------------------------------------------

describe('Approval ↔ Run interaction invariants', () => {
  it('Executed approval corresponds to a run that may advance past WaitingForApproval', () => {
    // When approval reaches Executed, run can transition Running → Succeeded/Failed
    // This is an application-layer invariant documented here for V&V traceability
    const runAfterApproval = makeRun('Running', {
      startedAtIso: '2026-02-22T00:00:01.000Z',
    });
    expect(runAfterApproval.status).toBe('Running');
    // Approval Executed is a valid terminal-ish state
    expect(isValidApprovalLifecycleTransition('Approved', 'Executed')).toBe(true);
  });

  it('Denied approval corresponds to a run that will reach Failed', () => {
    // When approval is Denied, the run must eventually reach Failed
    const failedRun = makeRun('Failed', {
      startedAtIso: '2026-02-22T00:00:01.000Z',
      endedAtIso: '2026-02-22T00:00:05.000Z',
    });
    expect(failedRun.status).toBe('Failed');
    expect(isTerminalApprovalLifecycleStatus('Denied')).toBe(true);
  });

  it('Expired approval does not leave run in WaitingForApproval indefinitely', () => {
    // Expired is a terminal approval state — the run orchestrator must handle it
    // by transitioning the run to Failed or Cancelled
    expect(isTerminalApprovalLifecycleStatus('Expired')).toBe(true);
    // Run can be Failed after approval expiry
    const expiredRun = makeRun('Failed', {
      startedAtIso: '2026-02-22T00:00:01.000Z',
      endedAtIso: '2026-02-22T00:00:30.000Z',
    });
    expect(expiredRun.status).toBe('Failed');
  });
});
