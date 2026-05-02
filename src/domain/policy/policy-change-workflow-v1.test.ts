import { describe, expect, it } from 'vitest';

import { ApprovalId, PolicyChangeId, UserId } from '../primitives/index.js';
import {
  applyStandardPolicyChangeV1,
  approvePolicyChangeV1,
  isPolicyChangeEffectiveForRunV1,
  markPolicyChangeRolledBackV1,
  parsePolicyChangeRequestV1,
  requiresPolicyChangeApproval,
  toPolicyChangeAuditEntryV1,
  type PolicyChangeRequestV1,
} from './policy-change-workflow-v1.js';

const BASE_POLICY = {
  schemaVersion: 1,
  policyId: 'pol-1',
  workspaceId: 'ws-1',
  name: 'Payments policy',
  active: true,
  priority: 10,
  version: 1,
  createdAtIso: '2026-01-01T00:00:00.000Z',
  createdByUserId: 'user-author',
};

const PROPOSED_POLICY = {
  ...BASE_POLICY,
  version: 2,
  rules: [{ ruleId: 'rule-1', condition: 'amount > 10000', effect: 'Deny' }],
};

function makeChange(overrides: Partial<PolicyChangeRequestV1> = {}): PolicyChangeRequestV1 {
  return parsePolicyChangeRequestV1({
    schemaVersion: 1,
    policyChangeId: 'pc-1',
    policyId: 'pol-1',
    workspaceId: 'ws-1',
    operation: 'Update',
    risk: 'High',
    status: 'PendingApproval',
    scope: { targetKind: 'ActionClass', workspaceId: 'ws-1', actionClass: 'payments.write' },
    basePolicy: BASE_POLICY,
    proposedPolicy: PROPOSED_POLICY,
    proposedAtIso: '2026-02-01T10:00:00.000Z',
    proposedByUserId: 'maker-1',
    rationale: 'Block high-value payment automation until finance approves the workflow.',
    diff: [{ path: '/rules/0', before: null, after: PROPOSED_POLICY.rules[0] }],
    runEffect: 'FutureRunsOnly',
    effectiveFromIso: '2026-02-01T11:00:00.000Z',
    expiresAtIso: '2026-05-01T00:00:00.000Z',
    approval: { approvalRequired: true, approvalId: 'approval-1' },
    ...overrides,
  });
}

describe('PolicyChangeRequestV1', () => {
  it('captures scope, rationale, diff, expiry, and approval metadata', () => {
    const change = makeChange();

    expect(change.scope).toEqual({
      targetKind: 'ActionClass',
      workspaceId: 'ws-1',
      actionClass: 'payments.write',
    });
    expect(change.diff).toHaveLength(1);
    expect(change.rationale).toContain('high-value');
    expect(change.approval.approvalId).toBe('approval-1');
    expect(requiresPolicyChangeApproval(change)).toBe(true);
  });

  it('rejects high-risk changes without approval and backwards expiry windows', () => {
    expect(() => makeChange({ approval: { approvalRequired: false } })).toThrow(
      /High-risk policy changes must require approval/i,
    );

    expect(() =>
      makeChange({
        effectiveFromIso: '2026-02-02T00:00:00.000Z',
        expiresAtIso: '2026-02-01T00:00:00.000Z',
      }),
    ).toThrow(/expiresAtIso must not precede effectiveFromIso/i);
  });

  it('enforces maker-checker approval for governed policy edits', () => {
    const change = makeChange();

    expect(() =>
      approvePolicyChangeV1({
        change,
        approvalId: ApprovalId('approval-1'),
        approvedByUserId: UserId('maker-1'),
        approvedAtIso: '2026-02-01T10:30:00.000Z',
      }),
    ).toThrow(/maker-checker/i);

    const approved = approvePolicyChangeV1({
      change,
      approvalId: ApprovalId('approval-1'),
      approvedByUserId: UserId('checker-1'),
      approvedAtIso: '2026-02-01T10:30:00.000Z',
    });

    expect(approved.status).toBe('Applied');
    expect(approved.approval.approvedByUserId).toBe('checker-1');
  });

  it('applies standard-risk changes without approval but keeps high-risk changes gated', () => {
    const standard = makeChange({
      risk: 'Standard',
      approval: { approvalRequired: false },
    });

    expect(applyStandardPolicyChangeV1(standard).status).toBe('Applied');
    expect(() => applyStandardPolicyChangeV1(makeChange())).toThrow(/require approval/i);
  });

  it('makes active Run versus future Run semantics explicit', () => {
    const futureOnly = approvePolicyChangeV1({
      change: makeChange(),
      approvalId: ApprovalId('approval-1'),
      approvedByUserId: UserId('checker-1'),
      approvedAtIso: '2026-02-01T10:30:00.000Z',
    });

    expect(
      isPolicyChangeEffectiveForRunV1({
        change: futureOnly,
        runStartedAtIso: '2026-02-01T10:59:59.000Z',
        evaluationAtIso: '2026-02-01T11:30:00.000Z',
      }),
    ).toBe(false);
    expect(
      isPolicyChangeEffectiveForRunV1({
        change: futureOnly,
        runStartedAtIso: '2026-02-01T11:00:00.000Z',
        evaluationAtIso: '2026-02-01T11:30:00.000Z',
      }),
    ).toBe(true);

    const activeAndFuture = makeChange({ runEffect: 'ActiveAndFutureRuns' });
    const applied = approvePolicyChangeV1({
      change: activeAndFuture,
      approvalId: ApprovalId('approval-1'),
      approvedByUserId: UserId('checker-1'),
      approvedAtIso: '2026-02-01T10:30:00.000Z',
    });
    expect(
      isPolicyChangeEffectiveForRunV1({
        change: applied,
        runStartedAtIso: '2026-02-01T10:00:00.000Z',
        evaluationAtIso: '2026-02-01T11:30:00.000Z',
      }),
    ).toBe(true);
  });

  it('records rollback as a first-class linked policy change state', () => {
    const applied = approvePolicyChangeV1({
      change: makeChange(),
      approvalId: ApprovalId('approval-1'),
      approvedByUserId: UserId('checker-1'),
      approvedAtIso: '2026-02-01T10:30:00.000Z',
    });

    const rolledBack = markPolicyChangeRolledBackV1({
      change: applied,
      rolledBackByPolicyChangeId: PolicyChangeId('pc-rollback-1'),
    });

    expect(rolledBack.status).toBe('RolledBack');
    expect(rolledBack.rolledBackByPolicyChangeId).toBe('pc-rollback-1');
  });

  it('emits durable audit facts answering who, why, when, and scope', () => {
    const change = makeChange();
    const audit = toPolicyChangeAuditEntryV1({
      change,
      eventType: 'PolicyChangeProposed',
      occurredAtIso: '2026-02-01T10:00:00.000Z',
      actorUserId: UserId('maker-1'),
      rationale: change.rationale,
    });

    expect(audit).toMatchObject({
      policyChangeId: 'pc-1',
      policyId: 'pol-1',
      eventType: 'PolicyChangeProposed',
      actorUserId: 'maker-1',
      rationale: change.rationale,
      policyVersion: 2,
      scope: { targetKind: 'ActionClass', actionClass: 'payments.write' },
    });
  });
});
