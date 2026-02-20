import { describe, expect, it } from 'vitest';

import { PolicyId, UserId, WorkspaceId } from '../primitives/index.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import {
  evaluatePolicies,
  evaluatePolicy,
  type PolicyEvaluationContextV1,
} from './policy-evaluation.js';

function makePolicy(
  overrides: Omit<Partial<PolicyV1>, 'policyId'> & { policyId?: string } = {},
): PolicyV1 {
  const { policyId: rawPolicyId, ...rest } = overrides;
  return {
    schemaVersion: 1,
    policyId: PolicyId(rawPolicyId ?? 'pol-inline-1'),
    workspaceId: WorkspaceId('ws-1'),
    name: 'Inline Rule Policy',
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

describe('evaluatePolicy inline rules', () => {
  it('applies inline Allow rule when condition matches', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        rules: [{ ruleId: 'allow-auto-tier', condition: 'run.tier == "Auto"', effect: 'Allow' }],
      }),
      context: makeContext({
        executionTier: 'Auto',
      }),
    });

    expect(result.decision).toBe('Allow');
    expect(result.inlineRuleErrors).toBeUndefined();
  });

  it('applies inline Deny rule when condition matches', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        rules: [
          {
            ruleId: 'deny-remote-stop',
            condition: 'actionOperation == "robot:estop_request"',
            effect: 'Deny',
          },
        ],
      }),
      context: makeContext({
        actionOperation: 'robot:estop_request',
      }),
    });

    expect(result.decision).toBe('Deny');
    expect(result.inlineRuleErrors).toBeUndefined();
  });

  it('fails closed when inline rule expression cannot be parsed', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        rules: [{ ruleId: 'bad-rule', condition: 'user.role == "admin";', effect: 'Allow' }],
      }),
      context: makeContext(),
    });

    expect(result.decision).toBe('Deny');
    expect(result.inlineRuleErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('Unsupported token')]),
    );
  });

  it('fails closed when inline rule evaluation times out', () => {
    const result = evaluatePolicy({
      policy: makePolicy({
        rules: [
          {
            ruleId: 'timeout-rule',
            condition: 'flags.first && flags.second',
            effect: 'Allow',
          },
        ],
      }),
      context: makeContext({
        ruleContext: { flags: { first: true, second: true } },
        ruleEvaluationMaxOperations: 1,
      }),
    });

    expect(result.decision).toBe('Deny');
    expect(result.inlineRuleErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('timed out')]),
    );
  });

  it('honors inline Deny decisions when aggregating policies', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({
          policyId: 'pol-1',
          rules: [{ ruleId: 'deny-auto', condition: 'executionTier == "Auto"', effect: 'Deny' }],
        }),
        makePolicy({ policyId: 'pol-2' }),
      ],
      context: makeContext({
        executionTier: 'Auto',
      }),
    });

    expect(result.decision).toBe('Deny');
    expect(result.inlineRuleErrors).toBeUndefined();
  });

  it('fails closed when any aggregated policy inline rule evaluation fails', () => {
    const result = evaluatePolicies({
      policies: [
        makePolicy({
          policyId: 'pol-1',
          rules: [{ ruleId: 'bad-rule', condition: 'user.role == "admin";', effect: 'Allow' }],
        }),
        makePolicy({ policyId: 'pol-2' }),
      ],
      context: makeContext(),
    });

    expect(result.decision).toBe('Deny');
    expect(result.inlineRuleErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('Unsupported token')]),
    );
  });
});
