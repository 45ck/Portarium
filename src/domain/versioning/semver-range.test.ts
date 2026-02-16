import { describe, expect, it } from 'vitest';

import { parseSemVer } from './semver.js';
import { parseSemVerRange, satisfiesSemVerRange } from './semver-range.js';

describe('semver-range', () => {
  it('parses "*" as any', () => {
    expect(parseSemVerRange('*')).toEqual({ kind: 'any' });
    expect(parseSemVerRange('')).toEqual({ kind: 'any' });
  });

  it('parses a conjunction of comparators', () => {
    const r = parseSemVerRange('>=1.2.0 <2.0.0');
    expect(r.kind).toBe('all');
    if (r.kind === 'all') expect(r.comparators).toHaveLength(2);
  });

  it('evaluates range satisfaction', () => {
    const r = parseSemVerRange('>=1.2.0 <2.0.0');
    expect(satisfiesSemVerRange(parseSemVer('1.2.0'), r)).toBe(true);
    expect(satisfiesSemVerRange(parseSemVer('1.9.9'), r)).toBe(true);
    expect(satisfiesSemVerRange(parseSemVer('2.0.0'), r)).toBe(false);
  });

  it('supports > and <= comparators', () => {
    const r = parseSemVerRange('>1.0.0 <=2.0.0');
    expect(satisfiesSemVerRange(parseSemVer('1.0.0'), r)).toBe(false);
    expect(satisfiesSemVerRange(parseSemVer('1.0.1'), r)).toBe(true);
    expect(satisfiesSemVerRange(parseSemVer('2.0.0'), r)).toBe(true);
    expect(satisfiesSemVerRange(parseSemVer('2.0.1'), r)).toBe(false);
  });

  it('treats bare versions as exact match', () => {
    const r = parseSemVerRange('1.2.3');
    expect(satisfiesSemVerRange(parseSemVer('1.2.3'), r)).toBe(true);
    expect(satisfiesSemVerRange(parseSemVer('1.2.4'), r)).toBe(false);
  });

  it('rejects invalid comparator tokens', () => {
    expect(() => parseSemVerRange('>')).toThrow(/Missing version/);
  });
});
