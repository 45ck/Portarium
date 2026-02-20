import { describe, expect, it } from 'vitest';

import {
  evaluatePolicyConditionDslV1,
  parsePolicyConditionDslV1,
  PolicyConditionSyntaxError,
} from './policy-condition-dsl-v1.js';

describe('parsePolicyConditionDslV1', () => {
  it('parses boolean expressions with comparison and logical operators', () => {
    expect(() =>
      parsePolicyConditionDslV1('run.tier == "Auto" && user.role === "admin"'),
    ).not.toThrow();
  });

  it('rejects malformed identifier paths', () => {
    expect(() => parsePolicyConditionDslV1('user..role == "admin"')).toThrow(
      PolicyConditionSyntaxError,
    );
  });

  it('rejects unsupported tokens', () => {
    expect(() => parsePolicyConditionDslV1('user.role == "admin";')).toThrow(/Unsupported token/);
  });
});

describe('evaluatePolicyConditionDslV1', () => {
  it('evaluates an allow condition to true', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'run.tier == "Auto" && user.role == "admin"',
      context: {
        run: { tier: 'Auto' },
        user: { role: 'admin' },
      },
    });

    expect(result).toEqual({ ok: true, value: true });
  });

  it('evaluates a deny condition to false', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'run.tier == "Auto" && user.role == "admin"',
      context: {
        run: { tier: 'Assisted' },
        user: { role: 'admin' },
      },
    });

    expect(result).toEqual({ ok: true, value: false });
  });

  it('supports contains and in semantics', () => {
    const containsResult = evaluatePolicyConditionDslV1({
      condition: 'resource.tags contains "restricted"',
      context: {
        resource: {
          tags: ['safe', 'restricted'],
        },
      },
    });
    expect(containsResult).toEqual({ ok: true, value: true });

    const inResult = evaluatePolicyConditionDslV1({
      condition: 'executionTier in allowedTiers',
      context: {
        executionTier: 'HumanApprove',
        allowedTiers: ['Auto', 'Assisted', 'HumanApprove'],
      },
    });
    expect(inResult).toEqual({ ok: true, value: true });
  });

  it('returns evaluation error when expression is not boolean', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'user.role',
      context: {
        user: { role: 'admin' },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected evaluation error result.');
    }
    expect(result.errorKind).toBe('EvaluationError');
  });

  it('returns timeout when operation budget is exceeded', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'flags.first && flags.second',
      context: {
        flags: { first: true, second: true },
      },
      maxOperations: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected timeout result.');
    }
    expect(result.errorKind).toBe('Timeout');
  });
});
