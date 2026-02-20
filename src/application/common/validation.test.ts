import { describe, expect, it } from 'vitest';
import {
  validate,
  requiredString,
  optionalString,
  minLength,
  maxLength,
  requiredFiniteNumber,
  oneOf,
  composeRules,
  type ValidationRule,
} from './validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SimpleInput {
  name: string;
  status?: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe('validate()', () => {
  it('returns ok(input) when no violations', () => {
    const input: SimpleInput = { name: 'hello' };
    const result = validate(input, [requiredString('name')]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(input);
  });

  it('returns err with single violation message as top-level message', () => {
    const input: SimpleInput = { name: '' };
    const result = validate(input, [requiredString('name')]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('ValidationFailed');
      expect(result.error.message).toBe('name must be a non-empty string.');
      expect(result.error.errors).toHaveLength(1);
    }
  });

  it('collects multiple violations in a single pass', () => {
    type SimpleInputWithCount = SimpleInput & { count: number };
    const input = { name: '', count: NaN } as unknown as SimpleInputWithCount;
    const result = validate(input, [
      requiredString<SimpleInputWithCount>('name'),
      requiredFiniteNumber<SimpleInputWithCount>('count'),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errors).toHaveLength(2);
      expect(result.error.message).toBe('2 validation errors.');
    }
  });

  it('runs all rules even after earlier violation', () => {
    const input: SimpleInput = { name: '' };
    const spy: ValidationRule<SimpleInput> = (_input, violations) => {
      violations.push({ field: 'status', message: 'status required' });
    };
    const result = validate(input, [requiredString('name'), spy]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.errors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// requiredString
// ---------------------------------------------------------------------------

describe('requiredString()', () => {
  it('passes for a non-empty string', () => {
    const r = validate({ name: 'Alice' } as SimpleInput, [requiredString('name')]);
    expect(r.ok).toBe(true);
  });

  it('fails for empty string', () => {
    const r = validate({ name: '' } as SimpleInput, [requiredString('name')]);
    expect(r.ok).toBe(false);
  });

  it('fails for whitespace-only string', () => {
    const r = validate({ name: '   ' } as SimpleInput, [requiredString('name')]);
    expect(r.ok).toBe(false);
  });

  it('fails for non-string value', () => {
    const r = validate({ name: 42 } as unknown as SimpleInput, [requiredString('name')]);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// optionalString
// ---------------------------------------------------------------------------

describe('optionalString()', () => {
  it('passes when field is absent', () => {
    const r = validate({ name: 'x' } as SimpleInput, [optionalString('status')]);
    expect(r.ok).toBe(true);
  });

  it('passes when field is a non-empty string', () => {
    const r = validate({ name: 'x', status: 'ok' } as SimpleInput, [optionalString('status')]);
    expect(r.ok).toBe(true);
  });

  it('fails when field is empty string', () => {
    const r = validate({ name: 'x', status: '' } as SimpleInput, [optionalString('status')]);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// minLength / maxLength
// ---------------------------------------------------------------------------

describe('minLength()', () => {
  it('passes when string meets minimum', () => {
    const r = validate({ name: 'abc' } as SimpleInput, [minLength('name', 3)]);
    expect(r.ok).toBe(true);
  });

  it('fails when string is too short', () => {
    const r = validate({ name: 'ab' } as SimpleInput, [minLength('name', 3)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.errors?.[0]?.field).toBe('name');
  });

  it('is a no-op when field is not a string (other rules catch that)', () => {
    const r = validate({ name: 42 } as unknown as SimpleInput, [minLength('name', 3)]);
    expect(r.ok).toBe(true);
  });
});

describe('maxLength()', () => {
  it('passes when string is within limit', () => {
    const r = validate({ name: 'hi' } as SimpleInput, [maxLength('name', 5)]);
    expect(r.ok).toBe(true);
  });

  it('fails when string exceeds limit', () => {
    const r = validate({ name: 'toolongname' } as SimpleInput, [maxLength('name', 5)]);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requiredFiniteNumber
// ---------------------------------------------------------------------------

describe('requiredFiniteNumber()', () => {
  interface WithCount {
    count: number;
  }
  it('passes for a finite number', () => {
    const r = validate({ count: 42 } as WithCount, [requiredFiniteNumber('count')]);
    expect(r.ok).toBe(true);
  });

  it('fails for NaN', () => {
    const r = validate({ count: NaN } as WithCount, [requiredFiniteNumber('count')]);
    expect(r.ok).toBe(false);
  });

  it('fails for Infinity', () => {
    const r = validate({ count: Infinity } as WithCount, [requiredFiniteNumber('count')]);
    expect(r.ok).toBe(false);
  });

  it('fails when field is a string', () => {
    const r = validate({ count: 'oops' } as unknown as WithCount, [requiredFiniteNumber('count')]);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// oneOf
// ---------------------------------------------------------------------------

describe('oneOf()', () => {
  const STATUSES = ['active', 'inactive'] as const;
  it('passes for an allowed value', () => {
    const r = validate({ name: 'x', status: 'active' } as SimpleInput, [oneOf('status', STATUSES)]);
    expect(r.ok).toBe(true);
  });

  it('fails for a disallowed value', () => {
    const r = validate({ name: 'x', status: 'unknown' } as SimpleInput, [
      oneOf('status', STATUSES),
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('active, inactive');
  });

  it('is a no-op when field is not a string', () => {
    const r = validate({ name: 'x', status: 42 } as unknown as SimpleInput, [
      oneOf('status', STATUSES),
    ]);
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// composeRules
// ---------------------------------------------------------------------------

describe('composeRules()', () => {
  const baseRules: readonly ValidationRule<SimpleInput>[] = [requiredString('name')];
  const extRules: readonly ValidationRule<SimpleInput>[] = [minLength('name', 3)];

  it('flattens rule sets into a single array', () => {
    const combined = composeRules<SimpleInput>(baseRules, extRules);
    expect(combined).toHaveLength(2);
  });

  it('applies all composed rules', () => {
    const combined = composeRules<SimpleInput>(baseRules, extRules);
    const r = validate({ name: 'ab' } as SimpleInput, combined);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RFC 9457 shape
// ---------------------------------------------------------------------------

describe('RFC 9457 errors extension', () => {
  it('populates errors array with field + message per violation', () => {
    const input = { name: '', status: 'bad' } as SimpleInput;
    const result = validate(input, [
      requiredString('name'),
      oneOf('status', ['active', 'inactive']),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.errors).toEqual([
        { field: 'name', message: 'name must be a non-empty string.' },
        { field: 'status', message: 'status must be one of: active, inactive.' },
      ]);
    }
  });
});
