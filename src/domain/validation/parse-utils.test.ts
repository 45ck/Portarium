import { describe, expect, it } from 'vitest';
import {
  parseBoolean,
  parseEnumValue,
  parseFiniteNumber,
  parseInteger,
  parseIsoDate,
  parseNonEmptyString,
  parseRecord,
  readBoolean,
  readEnum,
  readFiniteNumber,
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readNonNegativeNumber,
  readOptionalBoolean,
  readOptionalEnum,
  readOptionalFiniteNumber,
  readOptionalInteger,
  readOptionalIsoString,
  readOptionalNonNegativeInteger,
  readOptionalNonNegativeNumber,
  readOptionalRecordField,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readRecordField,
  readString,
  readStringArray,
} from './parse-utils.js';

class TestError extends Error {
  public override readonly name = 'TestError';
  public constructor(message: string) {
    super(message);
  }
}

const E = TestError;

describe('parseRecord', () => {
  it('returns an object', () => {
    expect(parseRecord({ a: 1 }, 'x', E)).toEqual({ a: 1 });
  });

  it('throws for non-object', () => {
    expect(() => parseRecord('nope', 'x', E)).toThrow(TestError);
    expect(() => parseRecord(null, 'x', E)).toThrow('x must be an object.');
    expect(() => parseRecord([1, 2], 'x', E)).toThrow(TestError);
  });
});

describe('parseNonEmptyString', () => {
  it('returns a non-empty string', () => {
    expect(parseNonEmptyString('hello', 'f', E)).toBe('hello');
  });

  it('throws for empty/blank/non-string', () => {
    expect(() => parseNonEmptyString('', 'f', E)).toThrow(TestError);
    expect(() => parseNonEmptyString('  ', 'f', E)).toThrow(TestError);
    expect(() => parseNonEmptyString(42, 'f', E)).toThrow('f must be a non-empty string.');
  });
});

describe('parseBoolean', () => {
  it('returns booleans', () => {
    expect(parseBoolean(true, 'f', E)).toBe(true);
    expect(parseBoolean(false, 'f', E)).toBe(false);
  });

  it('throws for non-boolean', () => {
    expect(() => parseBoolean(1, 'f', E)).toThrow('f must be a boolean.');
    expect(() => parseBoolean('true', 'f', E)).toThrow(TestError);
  });
});

describe('parseInteger', () => {
  it('returns safe integers', () => {
    expect(parseInteger(0, 'f', E)).toBe(0);
    expect(parseInteger(-5, 'f', E)).toBe(-5);
  });

  it('throws for non-integer', () => {
    expect(() => parseInteger(1.5, 'f', E)).toThrow('f must be an integer.');
    expect(() => parseInteger(Number.MAX_SAFE_INTEGER + 1, 'f', E)).toThrow(TestError);
    expect(() => parseInteger('1', 'f', E)).toThrow(TestError);
  });
});

describe('parseFiniteNumber', () => {
  it('returns finite numbers', () => {
    expect(parseFiniteNumber(3.14, 'f', E)).toBe(3.14);
  });

  it('throws for NaN/Infinity', () => {
    expect(() => parseFiniteNumber(Number.NaN, 'f', E)).toThrow(TestError);
    expect(() => parseFiniteNumber(Number.POSITIVE_INFINITY, 'f', E)).toThrow(
      'f must be a finite number.',
    );
  });
});

describe('parseEnumValue', () => {
  const VALS = ['a', 'b', 'c'] as const;

  it('accepts valid values', () => {
    expect(parseEnumValue('a', 'f', VALS, E)).toBe('a');
  });

  it('throws for invalid value', () => {
    expect(() => parseEnumValue('d', 'f', VALS, E)).toThrow('f must be one of: a, b, c.');
    expect(() => parseEnumValue('', 'f', VALS, E)).toThrow(TestError);
  });
});

describe('parseIsoDate', () => {
  it('parses valid ISO strings', () => {
    const d = parseIsoDate('2024-01-15T10:00:00.000Z', 'ts', E);
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });

  it('throws for invalid date strings', () => {
    expect(() => parseIsoDate('not-a-date', 'ts', E)).toThrow('ts must be a valid ISO timestamp.');
  });
});

describe('readRecord', () => {
  it('delegates to parseRecord', () => {
    const obj = { x: 1 };
    expect(readRecord(obj, 'Thing', E)).toBe(obj);
  });
});

describe('readString', () => {
  it('reads a string field', () => {
    expect(readString({ name: 'Alice' }, 'name', E)).toBe('Alice');
  });

  it('throws when field is missing or empty', () => {
    expect(() => readString({}, 'name', E)).toThrow(TestError);
    expect(() => readString({ name: '' }, 'name', E)).toThrow(TestError);
  });

  it('uses key as label by default', () => {
    expect(() => readString({}, 'email', E)).toThrow('email must be a non-empty string.');
  });

  it('prefixes path when opts.path is provided', () => {
    expect(() => readString({}, 'packId', E, { path: 'enabledPacks[0]' })).toThrow(
      'enabledPacks[0].packId must be a non-empty string.',
    );
  });

  it('uses bare key label when opts.path is undefined', () => {
    expect(() => readString({}, 'field', E, {})).toThrow('field must be a non-empty string.');
  });
});

describe('readOptionalString', () => {
  it('returns undefined when field is absent', () => {
    expect(readOptionalString({}, 'x', E)).toBeUndefined();
  });

  it('returns the string when present', () => {
    expect(readOptionalString({ x: 'hello' }, 'x', E)).toBe('hello');
  });

  it('throws for blank string', () => {
    expect(() => readOptionalString({ x: '' }, 'x', E)).toThrow(
      'x must be a non-empty string when provided.',
    );
  });

  it('uses requiredMessage when provided', () => {
    expect(() => readOptionalString({ x: '' }, 'x', E, { requiredMessage: 'custom msg' })).toThrow(
      'custom msg',
    );
  });

  it('prefixes path in default error when opts.path is provided', () => {
    expect(() => readOptionalString({ label: '' }, 'label', E, { path: 'item[2]' })).toThrow(
      'item[2].label must be a non-empty string when provided.',
    );
  });
});

describe('readBoolean', () => {
  it('reads boolean fields', () => {
    expect(readBoolean({ active: true }, 'active', E)).toBe(true);
  });

  it('throws for non-boolean', () => {
    expect(() => readBoolean({ active: 1 }, 'active', E)).toThrow(TestError);
  });

  it('uses key as label by default', () => {
    expect(() => readBoolean({ active: 'yes' }, 'active', E)).toThrow('active must be a boolean.');
  });

  it('prefixes path when opts.path is provided', () => {
    expect(() => readBoolean({ enabled: 'yes' }, 'enabled', E, { path: 'flags[1]' })).toThrow(
      'flags[1].enabled must be a boolean.',
    );
  });
});

describe('readOptionalBoolean', () => {
  it('returns undefined when absent', () => {
    expect(readOptionalBoolean({}, 'x', E)).toBeUndefined();
  });

  it('returns boolean when present', () => {
    expect(readOptionalBoolean({ x: false }, 'x', E)).toBe(false);
  });

  it('throws for non-boolean when present', () => {
    expect(() => readOptionalBoolean({ x: 1 }, 'x', E)).toThrow(
      'x must be a boolean when provided.',
    );
  });
});

describe('readInteger / readOptionalInteger', () => {
  it('reads integers', () => {
    expect(readInteger({ n: 42 }, 'n', E)).toBe(42);
  });

  it('readOptionalInteger returns undefined when absent', () => {
    expect(readOptionalInteger({}, 'n', E)).toBeUndefined();
  });

  it('readOptionalInteger returns value when present', () => {
    expect(readOptionalInteger({ n: 7 }, 'n', E)).toBe(7);
  });

  it('readOptionalInteger throws for non-integer', () => {
    expect(() => readOptionalInteger({ n: 1.1 }, 'n', E)).toThrow(TestError);
  });
});

describe('readNonNegativeInteger / readOptionalNonNegativeInteger', () => {
  it('allows zero', () => {
    expect(readNonNegativeInteger({ n: 0 }, 'n', E)).toBe(0);
  });

  it('throws for negative', () => {
    expect(() => readNonNegativeInteger({ n: -1 }, 'n', E)).toThrow(
      'n must be a non-negative integer.',
    );
  });

  it('readOptionalNonNegativeInteger returns undefined when absent', () => {
    expect(readOptionalNonNegativeInteger({}, 'n', E)).toBeUndefined();
  });

  it('readOptionalNonNegativeInteger throws for negative', () => {
    expect(() => readOptionalNonNegativeInteger({ n: -5 }, 'n', E)).toThrow(TestError);
  });
});

describe('readFiniteNumber / readOptionalFiniteNumber', () => {
  it('reads finite numbers', () => {
    expect(readFiniteNumber({ v: 3.14 }, 'v', E)).toBe(3.14);
  });

  it('readOptionalFiniteNumber returns undefined when absent', () => {
    expect(readOptionalFiniteNumber({}, 'v', E)).toBeUndefined();
  });
});

describe('readNonNegativeNumber / readOptionalNonNegativeNumber', () => {
  it('allows zero', () => {
    expect(readNonNegativeNumber({ v: 0 }, 'v', E)).toBe(0);
  });

  it('throws for negative', () => {
    expect(() => readNonNegativeNumber({ v: -0.1 }, 'v', E)).toThrow(
      'v must be a non-negative number.',
    );
  });

  it('readOptionalNonNegativeNumber returns undefined', () => {
    expect(readOptionalNonNegativeNumber({}, 'v', E)).toBeUndefined();
  });

  it('readOptionalNonNegativeNumber throws for negative', () => {
    expect(() => readOptionalNonNegativeNumber({ v: -1 }, 'v', E)).toThrow(TestError);
  });
});

describe('readIsoString / readOptionalIsoString', () => {
  it('reads valid ISO strings', () => {
    const ts = '2024-06-01T00:00:00.000Z';
    expect(readIsoString({ ts }, 'ts', E)).toBe(ts);
  });

  it('throws for invalid ISO', () => {
    expect(() => readIsoString({ ts: 'bad' }, 'ts', E)).toThrow(TestError);
  });

  it('readOptionalIsoString returns undefined when absent', () => {
    expect(readOptionalIsoString({}, 'ts', E)).toBeUndefined();
  });

  it('readOptionalIsoString throws for invalid ISO when present', () => {
    expect(() => readOptionalIsoString({ ts: 'bad' }, 'ts', E)).toThrow(TestError);
  });
});

describe('readEnum / readOptionalEnum', () => {
  const VALS = ['x', 'y'] as const;

  it('reads valid enum', () => {
    expect(readEnum({ v: 'x' }, 'v', VALS, E)).toBe('x');
  });

  it('throws for invalid enum', () => {
    expect(() => readEnum({ v: 'z' }, 'v', VALS, E)).toThrow(TestError);
  });

  it('readOptionalEnum returns undefined when absent', () => {
    expect(readOptionalEnum({}, 'v', VALS, E)).toBeUndefined();
  });

  it('readOptionalEnum throws for invalid value when present', () => {
    expect(() => readOptionalEnum({ v: 'z' }, 'v', VALS, E)).toThrow(TestError);
  });
});

describe('readStringArray / readOptionalStringArray', () => {
  it('reads string arrays', () => {
    expect(readStringArray({ tags: ['a', 'b'] }, 'tags', E)).toEqual(['a', 'b']);
  });

  it('throws for non-array', () => {
    expect(() => readStringArray({ tags: 'a' }, 'tags', E)).toThrow(TestError);
  });

  it('enforces minLength=1', () => {
    expect(() => readStringArray({ tags: [] }, 'tags', E, { minLength: 1 })).toThrow(
      'tags must be a non-empty array.',
    );
  });

  it('enforces minLength>1', () => {
    expect(() => readStringArray({ tags: ['a'] }, 'tags', E, { minLength: 2 })).toThrow(
      'tags must have length >= 2.',
    );
  });

  it('readOptionalStringArray returns undefined when absent', () => {
    expect(readOptionalStringArray({}, 'tags', E)).toBeUndefined();
  });

  it('readOptionalStringArray reads array when present', () => {
    expect(readOptionalStringArray({ tags: ['x'] }, 'tags', E)).toEqual(['x']);
  });
});

describe('readRecordField / readOptionalRecordField', () => {
  it('reads nested object fields', () => {
    const nested = { a: 1 };
    expect(readRecordField({ meta: nested }, 'meta', E)).toBe(nested);
  });

  it('throws for non-object', () => {
    expect(() => readRecordField({ meta: 'nope' }, 'meta', E)).toThrow(TestError);
  });

  it('readOptionalRecordField returns undefined when absent', () => {
    expect(readOptionalRecordField({}, 'meta', E)).toBeUndefined();
  });

  it('readOptionalRecordField throws for non-object when present', () => {
    expect(() => readOptionalRecordField({ meta: 42 }, 'meta', E)).toThrow(TestError);
  });
});
