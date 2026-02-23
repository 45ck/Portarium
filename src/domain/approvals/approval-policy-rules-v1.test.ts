import { describe, expect, it } from 'vitest';

import { PolicyId, UserId } from '../primitives/index.js';

import {
  createEvidenceRequiredRule,
  createExpiryCheckRule,
  createRiskThresholdRule,
  createSeparationOfDutiesRule,
  evaluatePolicySet,
  PolicyRuleEvaluationError,
  TraceBuilder,
  type PolicyEvaluationContextV1,
} from './approval-policy-rules-v1.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseContext: PolicyEvaluationContextV1 = {
  riskLevel: 'low',
  requestedByUserId: UserId('user-alice'),
  approverUserIds: [UserId('user-bob')],
  hasEvidence: true,
  evidenceCount: 2,
  hasDecisiveEvidence: true,
  requestedAtIso: '2026-01-15T10:00:00Z',
  evaluatedAtIso: '2026-01-15T14:00:00Z',
};

// ---------------------------------------------------------------------------
// TraceBuilder
// ---------------------------------------------------------------------------

describe('TraceBuilder', () => {
  it('builds an empty trace', () => {
    const trace = new TraceBuilder().build();
    expect(trace).toEqual([]);
    expect(Object.isFrozen(trace)).toBe(true);
  });

  it('records pass, fail, and skip entries with sequential seq numbers', () => {
    const trace = new TraceBuilder()
      .pass('check-a', 'ok')
      .fail('check-b', 'bad')
      .skip('check-c', 'not applicable')
      .build();

    expect(trace).toHaveLength(3);
    expect(trace[0]!.seq).toBe(0);
    expect(trace[0]!.check).toBe('check-a');
    expect(trace[0]!.result).toBe('pass');
    expect(trace[0]!.detail).toBe('ok');
    expect(trace[1]!.seq).toBe(1);
    expect(trace[1]!.result).toBe('fail');
    expect(trace[2]!.seq).toBe(2);
    expect(trace[2]!.result).toBe('skip');
  });

  it('omits detail when not provided', () => {
    const trace = new TraceBuilder().pass('check-a').build();
    expect('detail' in trace[0]!).toBe(false);
  });

  it('freezes individual entries', () => {
    const trace = new TraceBuilder().pass('check-a').build();
    expect(Object.isFrozen(trace[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Risk threshold rule
// ---------------------------------------------------------------------------

describe('createRiskThresholdRule', () => {
  const rule = createRiskThresholdRule(PolicyId('pol-risk'), 'high');

  it('passes when risk is below threshold', () => {
    const result = rule.evaluate({ ...baseContext, riskLevel: 'low' });
    expect(result.outcome).toBe('Pass');
    expect(result.policyId).toBe('pol-risk');
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]!.result).toBe('pass');
  });

  it('passes when risk is one step below threshold', () => {
    const result = rule.evaluate({ ...baseContext, riskLevel: 'medium' });
    expect(result.outcome).toBe('Pass');
  });

  it('returns NeedsHuman when risk equals threshold', () => {
    const result = rule.evaluate({ ...baseContext, riskLevel: 'high' });
    expect(result.outcome).toBe('NeedsHuman');
    expect(result.trace[0]!.result).toBe('fail');
  });

  it('returns NeedsHuman when risk exceeds threshold', () => {
    const result = rule.evaluate({ ...baseContext, riskLevel: 'critical' });
    expect(result.outcome).toBe('NeedsHuman');
  });

  it('supports low threshold (everything needs human except nothing below low)', () => {
    const lowRule = createRiskThresholdRule(PolicyId('pol-low'), 'low');
    expect(lowRule.evaluate({ ...baseContext, riskLevel: 'low' }).outcome).toBe('NeedsHuman');
    expect(lowRule.evaluate({ ...baseContext, riskLevel: 'critical' }).outcome).toBe('NeedsHuman');
  });

  it('includes evaluation timestamp', () => {
    const result = rule.evaluate(baseContext);
    expect(result.evaluatedAtIso).toBe('2026-01-15T14:00:00Z');
  });
});

// ---------------------------------------------------------------------------
// Separation of duties rule
// ---------------------------------------------------------------------------

describe('createSeparationOfDutiesRule', () => {
  const rule = createSeparationOfDutiesRule(PolicyId('pol-sod'));

  it('passes when requester is not in the approver list', () => {
    const result = rule.evaluate(baseContext);
    expect(result.outcome).toBe('Pass');
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]!.check).toBe('requester-not-approver');
  });

  it('passes when requester is an approver but others exist', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      approverUserIds: [UserId('user-alice'), UserId('user-bob')],
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Pass');
    expect(result.trace).toHaveLength(2);
  });

  it('fails when requester is the sole approver', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      approverUserIds: [UserId('user-alice')],
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Fail');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[1]!.check).toBe('no-other-approvers');
  });

  it('fails when requester appears multiple times as sole approver', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      approverUserIds: [UserId('user-alice'), UserId('user-alice')],
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Fail');
  });
});

// ---------------------------------------------------------------------------
// Evidence required rule
// ---------------------------------------------------------------------------

describe('createEvidenceRequiredRule', () => {
  it('passes when evidence meets default minimum', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'));
    const result = rule.evaluate(baseContext);
    expect(result.outcome).toBe('Pass');
  });

  it('fails when no evidence attached', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'));
    const result = rule.evaluate({
      ...baseContext,
      hasEvidence: false,
      evidenceCount: 0,
      hasDecisiveEvidence: false,
    });
    expect(result.outcome).toBe('Fail');
  });

  it('fails when evidence count is below custom minimum', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'), { minCount: 3 });
    const result = rule.evaluate({ ...baseContext, evidenceCount: 2 });
    expect(result.outcome).toBe('Fail');
    expect(result.trace[0]!.detail).toContain('2');
    expect(result.trace[0]!.detail).toContain('3');
  });

  it('passes when evidence count meets custom minimum', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'), { minCount: 2 });
    const result = rule.evaluate(baseContext);
    expect(result.outcome).toBe('Pass');
  });

  it('fails when decisive evidence required but not present', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'), { requireDecisive: true });
    const result = rule.evaluate({ ...baseContext, hasDecisiveEvidence: false });
    expect(result.outcome).toBe('Fail');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[1]!.check).toBe('decisive-evidence-check');
  });

  it('passes when decisive evidence required and present', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'), { requireDecisive: true });
    const result = rule.evaluate(baseContext);
    expect(result.outcome).toBe('Pass');
    expect(result.trace).toHaveLength(2);
  });

  it('skips decisive check when not required', () => {
    const rule = createEvidenceRequiredRule(PolicyId('pol-ev'));
    const result = rule.evaluate(baseContext);
    expect(result.trace).toHaveLength(2);
    expect(result.trace[1]!.result).toBe('skip');
  });
});

// ---------------------------------------------------------------------------
// Expiry check rule
// ---------------------------------------------------------------------------

describe('createExpiryCheckRule', () => {
  const rule = createExpiryCheckRule(PolicyId('pol-expiry'));

  it('passes with skip when no expiry is set', () => {
    const result = rule.evaluate(baseContext);
    expect(result.outcome).toBe('Pass');
    expect(result.trace[0]!.result).toBe('skip');
  });

  it('passes when evaluation time is before expiry', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      expiresAtIso: '2026-01-16T00:00:00Z',
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Pass');
    expect(result.trace[0]!.result).toBe('pass');
  });

  it('fails when evaluation time equals expiry', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      evaluatedAtIso: '2026-01-15T14:00:00Z',
      expiresAtIso: '2026-01-15T14:00:00Z',
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Fail');
  });

  it('fails when evaluation time is after expiry', () => {
    const ctx: PolicyEvaluationContextV1 = {
      ...baseContext,
      expiresAtIso: '2026-01-15T10:00:00Z',
    };
    const result = rule.evaluate(ctx);
    expect(result.outcome).toBe('Fail');
    expect(result.trace[0]!.result).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicySet
// ---------------------------------------------------------------------------

describe('evaluatePolicySet', () => {
  it('throws for empty rule set', () => {
    expect(() => evaluatePolicySet([], baseContext)).toThrow(PolicyRuleEvaluationError);
  });

  it('returns Pass when all rules pass', () => {
    const rules = [
      createRiskThresholdRule(PolicyId('pol-1'), 'high'),
      createEvidenceRequiredRule(PolicyId('pol-2')),
      createExpiryCheckRule(PolicyId('pol-3')),
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.aggregateOutcome).toBe('Pass');
    expect(result.results).toHaveLength(3);
    expect(result.totalTraceEntryCount).toBeGreaterThan(0);
  });

  it('returns Fail when any rule fails', () => {
    const rules = [
      createRiskThresholdRule(PolicyId('pol-1'), 'high'),
      createEvidenceRequiredRule(PolicyId('pol-2'), { minCount: 10 }),
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.aggregateOutcome).toBe('Fail');
  });

  it('returns NeedsHuman when no failures but a rule needs human', () => {
    const rules = [
      createRiskThresholdRule(PolicyId('pol-1'), 'low'), // NeedsHuman for low risk
      createEvidenceRequiredRule(PolicyId('pol-2')),
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.aggregateOutcome).toBe('NeedsHuman');
  });

  it('Fail takes priority over NeedsHuman', () => {
    const rules = [
      createRiskThresholdRule(PolicyId('pol-1'), 'low'), // NeedsHuman
      createEvidenceRequiredRule(PolicyId('pol-2'), { minCount: 100 }), // Fail
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.aggregateOutcome).toBe('Fail');
  });

  it('evaluates all rules (no short-circuit)', () => {
    const rules = [
      createEvidenceRequiredRule(PolicyId('pol-1'), { minCount: 100 }), // Fail
      createSeparationOfDutiesRule(PolicyId('pol-2')), // Pass
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.outcome).toBe('Fail');
    expect(result.results[1]!.outcome).toBe('Pass');
  });

  it('computes correct totalTraceEntryCount', () => {
    const rules = [
      createRiskThresholdRule(PolicyId('pol-1'), 'high'), // 1 trace entry
      createSeparationOfDutiesRule(PolicyId('pol-2')), // 1 trace entry
    ];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.totalTraceEntryCount).toBe(2);
  });

  it('includes evaluation timestamp', () => {
    const rules = [createExpiryCheckRule(PolicyId('pol-1'))];
    const result = evaluatePolicySet(rules, baseContext);
    expect(result.evaluatedAtIso).toBe('2026-01-15T14:00:00Z');
  });

  it('returns frozen result', () => {
    const rules = [createExpiryCheckRule(PolicyId('pol-1'))];
    const result = evaluatePolicySet(rules, baseContext);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.results)).toBe(true);
  });
});
