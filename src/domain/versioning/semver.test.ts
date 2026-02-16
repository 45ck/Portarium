import { describe, expect, it } from 'vitest';

import { compareSemVer, formatSemVer, parseSemVer } from './semver.js';

describe('semver', () => {
  it('parses a plain SemVer', () => {
    expect(parseSemVer('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      preRelease: [],
      build: null,
    });
  });

  it('parses pre-release and build metadata', () => {
    expect(parseSemVer('1.2.3-alpha.1+build.9')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      preRelease: ['alpha', 1],
      build: 'build.9',
    });
  });

  it('formats SemVer', () => {
    const v = parseSemVer('2.0.1-rc.0+ci.123');
    expect(formatSemVer(v)).toBe('2.0.1-rc.0+ci.123');
  });

  it('orders release after pre-release', () => {
    const release = parseSemVer('1.0.0');
    const pre = parseSemVer('1.0.0-alpha.1');
    expect(compareSemVer(release, pre)).toBeGreaterThan(0);
  });

  it('orders pre-release identifiers correctly', () => {
    const a = parseSemVer('1.0.0-alpha.2');
    const b = parseSemVer('1.0.0-alpha.10');
    expect(compareSemVer(a, b)).toBeLessThan(0);
  });

  it('orders numeric identifiers before non-numeric identifiers', () => {
    const num = parseSemVer('1.0.0-1');
    const str = parseSemVer('1.0.0-alpha');
    expect(compareSemVer(num, str)).toBeLessThan(0);
    expect(compareSemVer(str, num)).toBeGreaterThan(0);
  });

  it('orders pre-release strings lexicographically', () => {
    const a = parseSemVer('1.0.0-alpha');
    const b = parseSemVer('1.0.0-beta');
    expect(compareSemVer(a, b)).toBeLessThan(0);
  });

  it('orders shorter pre-release identifier lists first when equal so far', () => {
    const a = parseSemVer('1.0.0-alpha');
    const b = parseSemVer('1.0.0-alpha.1');
    expect(compareSemVer(a, b)).toBeLessThan(0);
  });

  it('rejects invalid SemVer strings', () => {
    expect(() => parseSemVer('1.2')).toThrow(/Invalid SemVer/);
    expect(() => parseSemVer('1.2.3.4')).toThrow(/Invalid SemVer/);
    expect(() => parseSemVer('01.2.3')).toThrow(/Invalid SemVer/);
    expect(() => parseSemVer('9007199254740993.0.0')).toThrow(/Invalid SemVer/);
  });
});
