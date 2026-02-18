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

  // RFC 8785 JCS compliance — cross-language determinism test vectors
  it('RFC 8785: empty object produces {}', () => {
    expect(canonicalizeJson({})).toBe('{}');
  });

  it('RFC 8785: nested objects have inner keys sorted independently', () => {
    const input = { b: { d: 2, c: 3 }, a: 1 };
    expect(canonicalizeJson(input)).toBe('{"a":1,"b":{"c":3,"d":2}}');
  });

  it('RFC 8785: Unicode key ordering uses code point order (U+00E9 > U+0061)', () => {
    // 'é' is U+00E9 (> 'a' U+0061 and 'z' U+007A) — must sort after ASCII chars
    const input = { é: 1, z: 2, a: 3 };
    expect(canonicalizeJson(input)).toBe('{"a":3,"z":2,"\u00e9":1}');
  });

  it('RFC 8785: integer numbers serialized without decimal point', () => {
    expect(canonicalizeJson({ n: 1.0 })).toBe('{"n":1}');
    expect(canonicalizeJson({ n: -42.0 })).toBe('{"n":-42}');
  });

  it('RFC 8785: non-integer numbers use shortest round-trip form', () => {
    expect(canonicalizeJson({ n: 1.5 })).toBe('{"n":1.5}');
    expect(canonicalizeJson({ n: 0.1 })).toBe('{"n":0.1}');
  });
});
