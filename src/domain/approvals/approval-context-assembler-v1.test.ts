import { describe, expect, it } from 'vitest';

import { ApprovalId, UserId, WorkspaceId } from '../primitives/index.js';

import {
  assembleApprovalContext,
  getDelegators,
  hasDelegation,
  isDecided,
  summarizeApprovalContext,
  type AssembleApprovalContextInput,
} from './approval-context-assembler-v1.js';
import { createDecisionRecord } from './approval-decision-record-v1.js';
import { createDelegationGrant } from './approval-delegation-v1.js';
import type { PolicySetEvaluationV1 } from './approval-policy-rules-v1.js';
import type { SnapshotVerificationResultV1 } from './approval-snapshot-binding-v1.js';
import type { EscalationEvaluationV1 } from './approval-escalation-v1.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseInput: AssembleApprovalContextInput = {
  approvalId: ApprovalId('apr-001'),
  lifecycleStatus: 'UnderReview',
  assembledAtIso: '2026-01-15T14:00:00Z',
};

const verifiedSnapshot: SnapshotVerificationResultV1 = Object.freeze({
  status: 'verified' as const,
  binding: Object.freeze({
    schemaVersion: 1 as const,
    subjectKind: 'approval_payload' as const,
    subjectLabel: 'Payload',
    contentHash: 'a'.repeat(64) as never,
    capturedAtIso: '2026-01-15T10:00:00Z',
  }),
  verifiedAtIso: '2026-01-15T14:00:00Z',
});

const driftedSnapshot: SnapshotVerificationResultV1 = Object.freeze({
  status: 'drifted' as const,
  binding: verifiedSnapshot.binding,
  currentHash: 'b'.repeat(64) as never,
  verifiedAtIso: '2026-01-15T14:00:00Z',
});

const passingPolicies: PolicySetEvaluationV1 = Object.freeze({
  results: Object.freeze([]),
  aggregateOutcome: 'Pass' as const,
  totalTraceEntryCount: 0,
  evaluatedAtIso: '2026-01-15T14:00:00Z',
});

const failingPolicies: PolicySetEvaluationV1 = Object.freeze({
  results: Object.freeze([]),
  aggregateOutcome: 'Fail' as const,
  totalTraceEntryCount: 1,
  evaluatedAtIso: '2026-01-15T14:00:00Z',
});

const needsHumanPolicies: PolicySetEvaluationV1 = Object.freeze({
  results: Object.freeze([]),
  aggregateOutcome: 'NeedsHuman' as const,
  totalTraceEntryCount: 1,
  evaluatedAtIso: '2026-01-15T14:00:00Z',
});

const escalatedEvaluation: EscalationEvaluationV1 = Object.freeze({
  isEscalated: true,
  activeStep: Object.freeze({
    stepOrder: 1,
    escalateToUserId: 'user-lead',
    afterHours: 4,
  }),
  activeStepIndex: 0,
  totalSteps: 2,
  elapsedHours: 5,
  fullyEscalated: false,
  sortedChain: Object.freeze([
    Object.freeze({ stepOrder: 1, escalateToUserId: 'user-lead', afterHours: 4 }),
    Object.freeze({ stepOrder: 2, escalateToUserId: 'user-manager', afterHours: 8 }),
  ]),
});

// ---------------------------------------------------------------------------
// assembleApprovalContext
// ---------------------------------------------------------------------------

describe('assembleApprovalContext', () => {
  it('assembles minimal context with defaults', () => {
    const ctx = assembleApprovalContext(baseInput);

    expect(ctx.approvalId).toBe('apr-001');
    expect(ctx.lifecycleStatus).toBe('UnderReview');
    expect(ctx.snapshotVerification).toBeNull();
    expect(ctx.policyEvaluation).toBeNull();
    expect(ctx.decisionRecord).toBeNull();
    expect(ctx.applicableDelegations).toEqual([]);
    expect(ctx.escalationEvaluation).toBeNull();
    expect(ctx.assembledAtIso).toBe('2026-01-15T14:00:00Z');
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('includes all provided pieces', () => {
    const decisionRecord = createDecisionRecord({
      approvalId: ApprovalId('apr-001'),
      workspaceId: WorkspaceId('ws-001'),
      decision: 'Approved',
      method: 'manual',
      rationale: 'All good.',
      decidedAtIso: '2026-01-15T14:30:00Z',
      decidedByUserId: UserId('user-bob'),
      riskLevel: 'low',
    });

    const delegation = createDelegationGrant({
      grantId: 'grant-001',
      delegatorUserId: UserId('user-alice'),
      delegateUserId: UserId('user-bob'),
      startsAtIso: '2026-01-15T00:00:00Z',
      expiresAtIso: '2026-01-22T00:00:00Z',
      reason: 'Vacation',
      createdAtIso: '2026-01-14T10:00:00Z',
    });

    const ctx = assembleApprovalContext({
      ...baseInput,
      snapshotVerification: verifiedSnapshot,
      policyEvaluation: passingPolicies,
      decisionRecord,
      applicableDelegations: [delegation],
      escalationEvaluation: escalatedEvaluation,
    });

    expect(ctx.snapshotVerification).toBe(verifiedSnapshot);
    expect(ctx.policyEvaluation).toBe(passingPolicies);
    expect(ctx.decisionRecord).toBe(decisionRecord);
    expect(ctx.applicableDelegations).toHaveLength(1);
    expect(ctx.escalationEvaluation).toBe(escalatedEvaluation);
  });
});

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

describe('readiness computation', () => {
  it('canDecide is true for UnderReview with passing policies', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      policyEvaluation: passingPolicies,
    });
    expect(ctx.readiness.canDecide).toBe(true);
    expect(ctx.readiness.blockingReasons).toHaveLength(0);
  });

  it('canDecide is true for Open status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Open',
    });
    expect(ctx.readiness.canDecide).toBe(true);
  });

  it('canDecide is true for Assigned status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Assigned',
    });
    expect(ctx.readiness.canDecide).toBe(true);
  });

  it('canDecide is false for Denied status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Denied',
    });
    expect(ctx.readiness.canDecide).toBe(false);
    expect(ctx.readiness.blockingReasons.length).toBeGreaterThan(0);
  });

  it('canDecide is false for Executed status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Executed',
    });
    expect(ctx.readiness.canDecide).toBe(false);
  });

  it('canDecide is false for Expired status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Expired',
    });
    expect(ctx.readiness.canDecide).toBe(false);
    expect(ctx.readiness.isExpired).toBe(true);
    expect(ctx.readiness.blockingReasons).toContainEqual(expect.stringContaining('expired'));
  });

  it('canDecide is false when policies fail', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      policyEvaluation: failingPolicies,
    });
    expect(ctx.readiness.canDecide).toBe(false);
    expect(ctx.readiness.policiesPass).toBe(false);
    expect(ctx.readiness.blockingReasons).toContainEqual(expect.stringContaining('policies'));
  });

  it('canDecide is true when policies need human (not a blocker)', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      policyEvaluation: needsHumanPolicies,
    });
    expect(ctx.readiness.canDecide).toBe(true);
    expect(ctx.readiness.policiesNeedHuman).toBe(true);
  });

  it('snapshotVerified is true for verified snapshot', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      snapshotVerification: verifiedSnapshot,
    });
    expect(ctx.readiness.snapshotVerified).toBe(true);
  });

  it('snapshotVerified is false for drifted snapshot with blocking reason', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      snapshotVerification: driftedSnapshot,
    });
    expect(ctx.readiness.snapshotVerified).toBe(false);
    expect(ctx.readiness.blockingReasons).toContainEqual(expect.stringContaining('drifted'));
  });

  it('snapshotVerified is false when no snapshot provided', () => {
    const ctx = assembleApprovalContext(baseInput);
    expect(ctx.readiness.snapshotVerified).toBe(false);
  });

  it('isEscalated reflects escalation evaluation', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      escalationEvaluation: escalatedEvaluation,
    });
    expect(ctx.readiness.isEscalated).toBe(true);
  });

  it('readiness is frozen', () => {
    const ctx = assembleApprovalContext(baseInput);
    expect(Object.isFrozen(ctx.readiness)).toBe(true);
    expect(Object.isFrozen(ctx.readiness.blockingReasons)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

describe('isDecided', () => {
  it('returns false when no decision record', () => {
    const ctx = assembleApprovalContext(baseInput);
    expect(isDecided(ctx)).toBe(false);
  });

  it('returns true when decision record exists', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      decisionRecord: createDecisionRecord({
        approvalId: ApprovalId('apr-001'),
        workspaceId: WorkspaceId('ws-001'),
        decision: 'Approved',
        method: 'manual',
        rationale: 'OK.',
        decidedAtIso: '2026-01-15T14:30:00Z',
        decidedByUserId: UserId('user-bob'),
        riskLevel: 'low',
      }),
    });
    expect(isDecided(ctx)).toBe(true);
  });
});

describe('hasDelegation', () => {
  it('returns false when no delegations', () => {
    const ctx = assembleApprovalContext(baseInput);
    expect(hasDelegation(ctx)).toBe(false);
  });

  it('returns true when delegations exist', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      applicableDelegations: [
        createDelegationGrant({
          grantId: 'g-1',
          delegatorUserId: UserId('user-alice'),
          delegateUserId: UserId('user-bob'),
          startsAtIso: '2026-01-15T00:00:00Z',
          expiresAtIso: '2026-01-22T00:00:00Z',
          reason: 'Vacation',
          createdAtIso: '2026-01-14T10:00:00Z',
        }),
      ],
    });
    expect(hasDelegation(ctx)).toBe(true);
  });
});

describe('getDelegators', () => {
  it('returns empty for no delegations', () => {
    const ctx = assembleApprovalContext(baseInput);
    expect(getDelegators(ctx)).toEqual([]);
  });

  it('returns delegator user IDs', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      applicableDelegations: [
        createDelegationGrant({
          grantId: 'g-1',
          delegatorUserId: UserId('user-alice'),
          delegateUserId: UserId('user-bob'),
          startsAtIso: '2026-01-15T00:00:00Z',
          expiresAtIso: '2026-01-22T00:00:00Z',
          reason: 'Vacation',
          createdAtIso: '2026-01-14T10:00:00Z',
        }),
      ],
    });
    expect(getDelegators(ctx)).toEqual(['user-alice']);
  });
});

// ---------------------------------------------------------------------------
// summarizeApprovalContext
// ---------------------------------------------------------------------------

describe('summarizeApprovalContext', () => {
  it('produces minimal summary', () => {
    const ctx = assembleApprovalContext(baseInput);
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Approval: apr-001');
    expect(summary).toContain('Status: UnderReview');
    expect(summary).toContain('Can decide: true');
  });

  it('includes snapshot status when verified', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      snapshotVerification: verifiedSnapshot,
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Snapshot: verified');
  });

  it('includes snapshot DRIFTED warning', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      snapshotVerification: driftedSnapshot,
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Snapshot: DRIFTED');
  });

  it('includes policy outcome', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      policyEvaluation: passingPolicies,
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Policies: Pass');
  });

  it('includes escalation status', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      escalationEvaluation: escalatedEvaluation,
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Escalated: yes');
  });

  it('includes delegation count', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      applicableDelegations: [
        createDelegationGrant({
          grantId: 'g-1',
          delegatorUserId: UserId('user-alice'),
          delegateUserId: UserId('user-bob'),
          startsAtIso: '2026-01-15T00:00:00Z',
          expiresAtIso: '2026-01-22T00:00:00Z',
          reason: 'Vacation',
          createdAtIso: '2026-01-14T10:00:00Z',
        }),
      ],
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Delegations: 1');
  });

  it('includes blocking reason count', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      lifecycleStatus: 'Expired',
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Blocked:');
  });

  it('includes decision when present', () => {
    const ctx = assembleApprovalContext({
      ...baseInput,
      decisionRecord: createDecisionRecord({
        approvalId: ApprovalId('apr-001'),
        workspaceId: WorkspaceId('ws-001'),
        decision: 'Denied',
        method: 'manual',
        rationale: 'Rejected.',
        decidedAtIso: '2026-01-15T14:30:00Z',
        decidedByUserId: UserId('user-bob'),
        riskLevel: 'high',
      }),
    });
    const summary = summarizeApprovalContext(ctx);
    expect(summary).toContain('Decision: Denied');
  });
});
