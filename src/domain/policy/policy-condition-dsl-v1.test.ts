import { describe, expect, it } from 'vitest';

import {
  evaluatePolicyConditionDslV1,
  parsePolicyConditionDslV1,
  PolicyConditionSyntaxError,
} from './policy-condition-dsl-v1.js';
import { evaluatePolicyConditionDslAstV1 } from './policy-condition-dsl-v1.evaluator.js';
import { parsePolicyConditionDslAstV1 } from './policy-condition-dsl-v1.parser.js';
import { tokenizePolicyConditionDslV1 } from './policy-condition-dsl-v1.tokenizer.js';

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

  it('evaluates not operator', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'not flag',
        context: { flag: false },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: '! flag',
        context: { flag: true },
      }),
    ).toEqual({ ok: true, value: false });
  });

  it('short-circuits or when left is true', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'a || b',
        context: { a: true, b: false },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'a or b',
        context: { a: false, b: true },
      }),
    ).toEqual({ ok: true, value: true });
  });

  it('evaluates comparison operators neq, lt, lte, gt, gte', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x != 1',
        context: { x: 2 },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x !== 1',
        context: { x: 1 },
      }),
    ).toEqual({ ok: true, value: false });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x < 5',
        context: { x: 3 },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x <= 5',
        context: { x: 5 },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x > 3',
        context: { x: 5 },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x >= 5',
        context: { x: 5 },
      }),
    ).toEqual({ ok: true, value: true });
  });

  it('compares strings with ordered operators', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'name < "z"',
        context: { name: 'a' },
      }),
    ).toEqual({ ok: true, value: true });
  });

  it('returns false for compareOrdered with mismatched types', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x < "foo"',
        context: { x: 5 },
      }),
    ).toEqual({ ok: true, value: false });
  });

  it('supports contains for string substring check', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'msg contains "hello"',
        context: { msg: 'say hello world' },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'msg contains "missing"',
        context: { msg: 'say hello world' },
      }),
    ).toEqual({ ok: true, value: false });
  });

  it('returns false for contains with non-string non-array left', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x contains "foo"',
        context: { x: 42 },
      }),
    ).toEqual({ ok: true, value: false });
  });

  it('returns false for in where right is not an array', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x in notAnArray',
        context: { x: 'foo', notAnArray: 'bar' },
      }),
    ).toEqual({ ok: true, value: false });
  });

  it('returns evaluation error when and operand is not boolean', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'x && y',
      context: { x: 'string', y: true },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errorKind).toBe('EvaluationError');
  });

  it('returns evaluation error when or operand is not boolean', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'x || y',
      context: { x: 'string', y: true },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errorKind).toBe('EvaluationError');
  });

  it('returns parse error for invalid syntax', () => {
    const result = evaluatePolicyConditionDslV1({
      condition: 'x == ;',
      context: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected error');
    expect(result.errorKind).toBe('ParseError');
  });

  it('evaluates with number and boolean literals in conditions', () => {
    expect(
      evaluatePolicyConditionDslV1({
        condition: 'x == 42',
        context: { x: 42 },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'flag == true',
        context: { flag: true },
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      evaluatePolicyConditionDslV1({
        condition: 'val == null',
        context: { val: null },
      }),
    ).toEqual({ ok: true, value: true });
  });
});

describe('evaluatePolicyConditionDslAstV1', () => {
  it('throws when maxOperations is not a positive integer', () => {
    const ast = parsePolicyConditionDslAstV1('true');
    expect(() => evaluatePolicyConditionDslAstV1({ ast, context: {}, maxOperations: 0 })).toThrow(
      /maxOperations must be a positive integer/,
    );
    expect(() => evaluatePolicyConditionDslAstV1({ ast, context: {}, maxOperations: -1 })).toThrow(
      /maxOperations must be a positive integer/,
    );
  });
});

describe('tokenizePolicyConditionDslV1', () => {
  it('tokenizes number literals', () => {
    const tokens = tokenizePolicyConditionDslV1('42');
    expect(tokens[0]).toMatchObject({ type: 'number', value: 42 });

    const floatTokens = tokenizePolicyConditionDslV1('3.14');
    expect(floatTokens[0]).toMatchObject({ type: 'number', value: 3.14 });

    const negativeTokens = tokenizePolicyConditionDslV1('-7');
    expect(negativeTokens[0]).toMatchObject({ type: 'number', value: -7 });
  });

  it('tokenizes boolean and null literals', () => {
    expect(tokenizePolicyConditionDslV1('true')[0]).toMatchObject({ type: 'boolean', value: true });
    expect(tokenizePolicyConditionDslV1('false')[0]).toMatchObject({
      type: 'boolean',
      value: false,
    });
    expect(tokenizePolicyConditionDslV1('null')[0]).toMatchObject({ type: 'null', value: null });
  });

  it('tokenizes keyword operators', () => {
    for (const kw of [
      'and',
      'or',
      'not',
      'eq',
      'neq',
      'lt',
      'lte',
      'gt',
      'gte',
      'in',
      'contains',
    ]) {
      const tokens = tokenizePolicyConditionDslV1(kw);
      expect(tokens[0]?.type).toBe(kw);
    }
  });

  it('tokenizes punctuation operators', () => {
    expect(tokenizePolicyConditionDslV1('!==')[0]).toMatchObject({ type: 'neq' });
    expect(tokenizePolicyConditionDslV1('===')[0]).toMatchObject({ type: 'eq' });
    expect(tokenizePolicyConditionDslV1('&&')[0]).toMatchObject({ type: 'and' });
    expect(tokenizePolicyConditionDslV1('||')[0]).toMatchObject({ type: 'or' });
    expect(tokenizePolicyConditionDslV1('<=')[0]).toMatchObject({ type: 'lte' });
    expect(tokenizePolicyConditionDslV1('>=')[0]).toMatchObject({ type: 'gte' });
    expect(tokenizePolicyConditionDslV1('<')[0]).toMatchObject({ type: 'lt' });
    expect(tokenizePolicyConditionDslV1('>')[0]).toMatchObject({ type: 'gt' });
    expect(tokenizePolicyConditionDslV1('!')[0]).toMatchObject({ type: 'not' });
    expect(tokenizePolicyConditionDslV1('(')[0]).toMatchObject({ type: 'lparen' });
    expect(tokenizePolicyConditionDslV1(')')[0]).toMatchObject({ type: 'rparen' });
  });

  it('tokenizes string escape sequences', () => {
    const tokens = tokenizePolicyConditionDslV1('"line\\nbreak"');
    expect(tokens[0]).toMatchObject({ type: 'string', value: 'line\nbreak' });

    const tabTokens = tokenizePolicyConditionDslV1('"tab\\there"');
    expect(tabTokens[0]).toMatchObject({ type: 'string', value: 'tab\there' });

    const crTokens = tokenizePolicyConditionDslV1('"cr\\rend"');
    expect(crTokens[0]).toMatchObject({ type: 'string', value: 'cr\rend' });

    const backslashTokens = tokenizePolicyConditionDslV1('"back\\\\slash"');
    expect(backslashTokens[0]).toMatchObject({ type: 'string', value: 'back\\slash' });

    const doubleQuoteTokens = tokenizePolicyConditionDslV1('"say \\"hi\\""');
    expect(doubleQuoteTokens[0]).toMatchObject({ type: 'string', value: 'say "hi"' });

    const singleQuoteTokens = tokenizePolicyConditionDslV1("'it\\'s'");
    expect(singleQuoteTokens[0]).toMatchObject({ type: 'string', value: "it's" });

    const unknownEscapeTokens = tokenizePolicyConditionDslV1('"\\z"');
    expect(unknownEscapeTokens[0]).toMatchObject({ type: 'string', value: 'z' });
  });

  it('throws on unterminated escape sequence at end of input', () => {
    expect(() => tokenizePolicyConditionDslV1('"trailing\\')).toThrow(
      /Unterminated escape sequence/,
    );
  });

  it('throws on unterminated string literal', () => {
    expect(() => tokenizePolicyConditionDslV1('"no close')).toThrow(/Unterminated string literal/);
  });

  it('throws on invalid identifier with leading dot', () => {
    expect(() => tokenizePolicyConditionDslV1('.foo')).toThrow(/Unsupported token/);
  });
});
