import { describe, expect, it } from 'vitest';
import { clampLimit, DEFAULT_LIMIT, MAX_LIMIT } from './query.js';

describe('clampLimit', () => {
  it('returns DEFAULT_LIMIT when undefined', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
  });

  it('returns DEFAULT_LIMIT for non-integer values', () => {
    expect(clampLimit(3.5)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(NaN)).toBe(DEFAULT_LIMIT);
  });

  it('returns DEFAULT_LIMIT for zero', () => {
    expect(clampLimit(0)).toBe(DEFAULT_LIMIT);
  });

  it('returns DEFAULT_LIMIT for negative values', () => {
    expect(clampLimit(-1)).toBe(DEFAULT_LIMIT);
  });

  it('clamps to MAX_LIMIT when exceeded', () => {
    expect(clampLimit(MAX_LIMIT + 1)).toBe(MAX_LIMIT);
    expect(clampLimit(1000)).toBe(MAX_LIMIT);
  });

  it('passes through valid values', () => {
    expect(clampLimit(1)).toBe(1);
    expect(clampLimit(10)).toBe(10);
    expect(clampLimit(50)).toBe(50);
    expect(clampLimit(MAX_LIMIT)).toBe(MAX_LIMIT);
  });
});
