import { describe, expect, it } from 'vitest';

import { canonicalizeJson } from './canonical-json.js';

describe('canonicalizeJson', () => {
  it('canonicalizes object keys in sorted order and omits undefined fields', () => {
    const a = canonicalizeJson({ b: 1, a: 2, z: undefined });
    const b = canonicalizeJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('preserves array order', () => {
    expect(canonicalizeJson([2, 1, 2])).toBe('[2,1,2]');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalizeJson({ x: Number.POSITIVE_INFINITY })).toThrow(/Non-finite/i);
    expect(() => canonicalizeJson({ x: Number.NaN })).toThrow(/Non-finite/i);
  });

  it('rejects non-plain objects', () => {
    expect(() => canonicalizeJson({ when: new Date('2026-02-16T00:00:00.000Z') })).toThrow(
      /plain objects/i,
    );
  });

  it('rejects unsupported primitive types', () => {
    expect(() => canonicalizeJson(BigInt(1))).toThrow(/Unsupported value type/i);
    expect(() => canonicalizeJson(() => 1)).toThrow(/Unsupported value type/i);
  });
});
