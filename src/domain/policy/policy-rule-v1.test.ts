import { describe, expect, it } from 'vitest';

import { parsePolicyRuleV1 } from './policy-rule-v1.js';

const VALID_RULE = {
  policyId: 'pol-1',
  ruleType: 'threshold',
  expression: 'amount > 1000',
  priority: 1,
};

describe('parsePolicyRuleV1: happy path', () => {
  it('parses a valid PolicyRuleV1', () => {
    const rule = parsePolicyRuleV1(VALID_RULE);

    expect(rule.policyId).toBe('pol-1');
    expect(rule.ruleType).toBe('threshold');
    expect(rule.expression).toBe('amount > 1000');
    expect(rule.priority).toBe(1);
  });
});

describe('parsePolicyRuleV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePolicyRuleV1('nope')).toThrow(/PolicyRule must be an object/i);
    expect(() => parsePolicyRuleV1(null)).toThrow(/PolicyRule must be an object/i);
    expect(() => parsePolicyRuleV1(42)).toThrow(/PolicyRule must be an object/i);
  });

  it('rejects missing policyId', () => {
    expect(() => parsePolicyRuleV1({ ...VALID_RULE, policyId: undefined })).toThrow(
      /policyId must be a non-empty string/i,
    );
  });

  it('rejects missing ruleType', () => {
    expect(() => parsePolicyRuleV1({ ...VALID_RULE, ruleType: undefined })).toThrow(
      /ruleType must be a non-empty string/i,
    );
  });

  it('rejects missing expression', () => {
    expect(() => parsePolicyRuleV1({ ...VALID_RULE, expression: undefined })).toThrow(
      /expression must be a non-empty string/i,
    );
  });

  it('rejects non-integer priority', () => {
    expect(() =>
      parsePolicyRuleV1({
        ...VALID_RULE,
        priority: 1.5,
      }),
    ).toThrow(/priority must be an integer/i);
  });

  it('rejects missing priority', () => {
    expect(() => parsePolicyRuleV1({ ...VALID_RULE, priority: undefined })).toThrow(
      /priority must be an integer/i,
    );
  });

  it('rejects non-string ruleType', () => {
    expect(() =>
      parsePolicyRuleV1({
        ...VALID_RULE,
        ruleType: 123,
      }),
    ).toThrow(/ruleType must be a non-empty string/i);
  });

  it('rejects non-string expression', () => {
    expect(() =>
      parsePolicyRuleV1({
        ...VALID_RULE,
        expression: false,
      }),
    ).toThrow(/expression must be a non-empty string/i);
  });
});
