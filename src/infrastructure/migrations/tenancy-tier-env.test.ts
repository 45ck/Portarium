import { describe, expect, it } from 'vitest';

import { readTenancyTierOverride, defaultTenancyTier } from './tenancy-tier-env.js';

describe('readTenancyTierOverride', () => {
  it('returns undefined when TENANCY_TIER is not set', () => {
    expect(readTenancyTierOverride({})).toBeUndefined();
  });

  it('returns undefined when TENANCY_TIER is empty', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: '' })).toBeUndefined();
    expect(readTenancyTierOverride({ TENANCY_TIER: '  ' })).toBeUndefined();
  });

  it('returns "A" when TENANCY_TIER is "A"', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: 'A' })).toBe('A');
  });

  it('returns "B" when TENANCY_TIER is "B"', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: 'B' })).toBe('B');
  });

  it('is case-insensitive', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: 'a' })).toBe('A');
    expect(readTenancyTierOverride({ TENANCY_TIER: 'b' })).toBe('B');
  });

  it('trims whitespace', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: '  A  ' })).toBe('A');
  });

  it('returns undefined for unrecognized values', () => {
    expect(readTenancyTierOverride({ TENANCY_TIER: 'C' })).toBeUndefined();
    expect(readTenancyTierOverride({ TENANCY_TIER: 'X' })).toBeUndefined();
  });
});

describe('defaultTenancyTier', () => {
  it('defaults to TierA when not set', () => {
    expect(defaultTenancyTier({})).toBe('TierA');
  });

  it('returns TierB when set to B', () => {
    expect(defaultTenancyTier({ TENANCY_TIER: 'B' })).toBe('TierB');
  });

  it('returns TierC when set to C', () => {
    expect(defaultTenancyTier({ TENANCY_TIER: 'C' })).toBe('TierC');
  });

  it('returns TierA for unknown values', () => {
    expect(defaultTenancyTier({ TENANCY_TIER: 'X' })).toBe('TierA');
  });
});
