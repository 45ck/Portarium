import { describe, expect, it } from 'vitest';

import { PolicyId, UserId, WorkspaceId } from '../primitives/index.js';
import type { PolicyV1 } from '../policy/policy-v1.js';

import {
  evaluatePolicy,
  evaluatePolicies,
  type PolicyEvaluationContextV1,
} from './policy-evaluation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePolicy(
  overrides: Omit<Partial<PolicyV1>, 'policyId'> & { policyId?: string } = {},
): PolicyV1 {
  const { policyId: rawPolicyId, ...rest } = overrides;
  return {
    schemaVersion: 1,
    policyId: PolicyId(rawPolicyId ?? 'pol-1'),
    workspaceId: WorkspaceId('ws-1'),
    name: 'Test Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-16T00:00:00.000Z',
    createdByUserId: UserId('creator-1'),
    ...rest,
  };
}

function makeContext(
  overrides: Partial<PolicyEvaluationContextV1> = {},
): PolicyEvaluationContextV1 {
  return {
    initiatorUserId: UserId('user-1'),
    approverUserIds: [UserId('user-2')],
    executionTier: 'Assisted',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// evaluatePolicy
// ---------------------------------------------------------------------------

describe('evaluatePolicy', () => {
  it('returns Allow when policy has no SoD constraints', () => {
    const result = evaluatePolicy({
      policy: makePolicy(),
      context: makeContext(),
    });

    expect(result.decision).toBe('Allow');
    expect(result.violations).toEqual([]);
    expect(result.evaluatedPolicyIds).toEqual([PolicyId('pol-1')]);
  });

  it('returns RequireApproval for MakerChecker violation', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [{ kind: 'MakerChecker' }],
      }),
      context: makeContext({
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-1')],
      }),
    });

    expect(result.decision).toBe('RequireApproval');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ kind: 'MakerCheckerViolation' });
  });

  it('returns RequireApproval for DistinctApprovers violation', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [{ kind: 'DistinctApprovers', minimumApprovers: 3 }],
      }),
      context: makeContext({
        approverUserIds: [UserId('user-2')],
      }),
    });

    expect(result.decision).toBe('RequireApproval');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ kind: 'DistinctApproversViolation' });
  });

  it('returns Deny for IncompatibleDuties violation', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [
          { kind: 'IncompatibleDuties', dutyKeys: ['payment:initiate', 'payment:approve'] },
        ],
      }),
      context: makeContext({
        performedDuties: [
          { userId: UserId('user-9'), dutyKey: 'payment:initiate' },
          { userId: UserId('user-9'), dutyKey: 'payment:approve' },
        ],
      }),
    });

    expect(result.decision).toBe('Deny');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ kind: 'IncompatibleDutiesViolation' });
  });

  it('returns Allow when SoD constraints are satisfied (no violations)', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        sodConstraints: [
          { kind: 'MakerChecker' },
          { kind: 'DistinctApprovers', minimumApprovers: 2 },
        ],
      }),
      context: makeContext({
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-2'), UserId('user-3')],
      }),
    });

    expect(result.decision).toBe('Allow');
    expect(result.violations).toEqual([]);
  });

  it('handles policy with undefined sodConstraints', () => {
    const policy = makePolicy();
    // Ensure sodConstraints is truly undefined
    expect(policy.sodConstraints).toBeUndefined();

    const result = evaluatePolicy({
      policy,
      context: makeContext(),
    });

    expect(result.decision).toBe('Allow');
    expect(result.violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicies
// ---------------------------------------------------------------------------

describe('evaluatePolicies', () => {
  it('aggregates violations from multiple policies', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({
          policyId: 'pol-1',
          sodConstraints: [{ kind: 'MakerChecker' }],
        }),
        makePolicy({
          policyId: 'pol-2',
          sodConstraints: [{ kind: 'DistinctApprovers', minimumApprovers: 3 }],
        }),
      ],
      context: makeContext({
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-1')],
      }),
    });

    expect(result.violations).toHaveLength(2);
    expect(result.violations.map((v) => v.kind)).toContain('MakerCheckerViolation');
    expect(result.violations.map((v) => v.kind)).toContain('DistinctApproversViolation');
  });

  it('returns most restrictive decision', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({
          policyId: 'pol-1',
          sodConstraints: [{ kind: 'MakerChecker' }],
        }),
        makePolicy({
          policyId: 'pol-2',
          sodConstraints: [
            { kind: 'IncompatibleDuties', dutyKeys: ['payment:initiate', 'payment:approve'] },
          ],
        }),
      ],
      context: makeContext({
        initiatorUserId: UserId('user-1'),
        approverUserIds: [UserId('user-1')],
        performedDuties: [
          { userId: UserId('user-9'), dutyKey: 'payment:initiate' },
          { userId: UserId('user-9'), dutyKey: 'payment:approve' },
        ],
      }),
    });

    // MakerChecker -> RequireApproval, IncompatibleDuties -> Deny
    // Most restrictive wins: Deny
    expect(result.decision).toBe('Deny');
  });

  it('returns Allow for empty policies array', () => {
    const result = evaluatePolicies({
      policies: [],
      context: makeContext(),
    });

    expect(result.decision).toBe('Allow');
    expect(result.violations).toEqual([]);
    expect(result.evaluatedPolicyIds).toEqual([]);
  });

  it('includes all evaluated policy IDs', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({ policyId: 'pol-a' }),
        makePolicy({ policyId: 'pol-b' }),
        makePolicy({ policyId: 'pol-c' }),
      ],
      context: makeContext(),
    });

    expect(result.evaluatedPolicyIds).toEqual([
      PolicyId('pol-a'),
      PolicyId('pol-b'),
      PolicyId('pol-c'),
    ]);
  });
});
