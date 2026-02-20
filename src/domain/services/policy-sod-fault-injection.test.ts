import { describe, expect, it } from 'vitest';

import type { ApprovalPendingV1 } from '../approvals/approval-v1.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import { ApprovalId, PlanId, PolicyId, RunId, UserId, WorkspaceId } from '../primitives/index.js';
import { evaluateApprovalRoutingSodV1 } from '../policy/sod-constraints-v1.js';
import { evaluatePolicies, evaluatePolicy } from './policy-evaluation.js';

function makePolicy(overrides: Partial<PolicyV1> = {}): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: PolicyId('pol-fault-1'),
    workspaceId: WorkspaceId('ws-fault-1'),
    name: 'Fault Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00.000Z',
    createdByUserId: UserId('creator-fault-1'),
    ...overrides,
  };
}

const PENDING_APPROVAL: ApprovalPendingV1 = {
  schemaVersion: 1,
  approvalId: ApprovalId('approval-fault-1'),
  workspaceId: WorkspaceId('ws-fault-1'),
  runId: RunId('run-fault-1'),
  planId: PlanId('plan-fault-1'),
  prompt: 'Fault-injection approval',
  requestedAtIso: '2026-02-20T00:00:00.000Z',
  requestedByUserId: UserId('initiator-fault-1'),
  status: 'Pending',
};

describe('policy and SoD fault-injection checks', () => {
  it('keeps Deny precedence when mixed with RequireApproval violations', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [
          { kind: 'MakerChecker' },
          { kind: 'IncompatibleDuties', dutyKeys: ['risk:initiate', 'risk:approve'] },
        ],
      }),
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-1')],
        performedDuties: [
          { userId: UserId('user-9'), dutyKey: 'risk:initiate' },
          { userId: UserId('user-9'), dutyKey: 'risk:approve' },
        ],
        executionTier: 'Assisted',
      },
    });

    expect(result.decision).toBe('Deny');
    expect(result.violations.map((v) => v.kind)).toEqual(
      expect.arrayContaining(['MakerCheckerViolation', 'IncompatibleDutiesViolation']),
    );
  });

  it('preserves Deny even when safety tier also recommends approval', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [{ kind: 'IncompatibleDuties', dutyKeys: ['duty:a', 'duty:b'] }],
      }),
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-2')],
        performedDuties: [
          { userId: UserId('user-x'), dutyKey: 'duty:a' },
          { userId: UserId('user-x'), dutyKey: 'duty:b' },
        ],
        executionTier: 'Auto',
        actionOperation: 'robot:execute_action',
        proximityZoneActive: true,
      },
    });

    expect(result.decision).toBe('Deny');
    expect(result.safetyTierRecommendation).toBe('HumanApprove');
  });

  it('aggregates policy ids and keeps most restrictive result under adversarial mix', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({
          policyId: PolicyId('pol-allow'),
          sodConstraints: [{ kind: 'DistinctApprovers', minimumApprovers: 1 }],
        }),
        makePolicy({
          policyId: PolicyId('pol-deny'),
          sodConstraints: [{ kind: 'IncompatibleDuties', dutyKeys: ['a', 'b'] }],
        }),
      ],
      context: {
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-2')],
        performedDuties: [
          { userId: UserId('user-7'), dutyKey: 'a' },
          { userId: UserId('user-7'), dutyKey: 'b' },
        ],
        executionTier: 'Assisted',
      },
    });

    expect(result.decision).toBe('Deny');
    expect(result.evaluatedPolicyIds).toEqual([PolicyId('pol-allow'), PolicyId('pol-deny')]);
  });

  it('flags remote e-stop self-authorization under duplicate approver history', () => {
    const violations = evaluateApprovalRoutingSodV1({
      approval: PENDING_APPROVAL,
      proposedApproverId: UserId('operator-1'),
      previousApproverIds: [UserId('operator-1'), UserId('operator-1')],
      constraints: [{ kind: 'RemoteEstopRequesterSeparation' }],
      robotContext: {
        remoteEstopRequest: true,
        estopRequesterUserId: UserId('operator-1'),
      },
    });

    expect(violations).toEqual([
      {
        kind: 'RemoteEstopRequesterSeparationViolation',
        estopRequesterUserId: UserId('operator-1'),
      },
    ]);
  });
});
