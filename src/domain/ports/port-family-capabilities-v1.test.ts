import { describe, expect, it } from 'vitest';
import { PORT_FAMILIES } from '../primitives/index.js';
import { portFamilyCapabilities, PORT_FAMILY_CAPABILITIES } from './port-family-capabilities-v1.js';

describe('PORT_FAMILY_CAPABILITIES', () => {
  it('has an entry for every port family', () => {
    for (const family of PORT_FAMILIES) {
      expect(PORT_FAMILY_CAPABILITIES[family]).toBeDefined();
      expect(PORT_FAMILY_CAPABILITIES[family].length).toBeGreaterThan(0);
    }
  });
});

describe('portFamilyCapabilities', () => {
  it('returns capabilities for a valid port family', () => {
    const caps = portFamilyCapabilities('FinanceAccounting');
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every((c) => typeof c === 'string')).toBe(true);
  });
});
