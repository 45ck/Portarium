import { describe, expect, it } from 'vitest';

import { CORE_EXTENSION_POINTS, isCoreExtensionPoint } from './core-extension-points.js';

describe('CoreExtensionPoints', () => {
  it('contains exactly 12 extension points', () => {
    expect(CORE_EXTENSION_POINTS).toHaveLength(12);
  });

  it('includes all expected extension points', () => {
    const expected = [
      'core.person',
      'core.organisation',
      'core.organisation_unit',
      'core.location',
      'core.asset',
      'core.transaction',
      'core.financial_transaction',
      'core.event',
      'core.record',
      'core.policy_object',
      'core.evidence_object',
      'core.relationship',
    ];
    expect([...CORE_EXTENSION_POINTS]).toEqual(expected);
  });
});

describe('isCoreExtensionPoint', () => {
  it('returns true for valid extension points', () => {
    expect(isCoreExtensionPoint('core.person')).toBe(true);
    expect(isCoreExtensionPoint('core.asset')).toBe(true);
    expect(isCoreExtensionPoint('core.relationship')).toBe(true);
  });

  it('returns false for invalid extension points', () => {
    expect(isCoreExtensionPoint('core.unknown')).toBe(false);
    expect(isCoreExtensionPoint('')).toBe(false);
    expect(isCoreExtensionPoint('person')).toBe(false);
  });
});
