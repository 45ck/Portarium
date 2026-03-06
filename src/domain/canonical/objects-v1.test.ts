import { describe, expect, it } from 'vitest';

import * as canonicalObjects from './objects-v1.js';

describe('canonical objects compatibility barrel', () => {
  it('exposes canonical ID aliases for direct compatibility imports', () => {
    expect(canonicalObjects.CanonicalTenantId('tenant-1')).toBe('tenant-1');
    expect(canonicalObjects.CanonicalPartyId('party-1')).toBe('party-1');
    expect(canonicalObjects.CanonicalTaskId('task-1')).toBe('task-1');
    expect(canonicalObjects.CanonicalAccountId('account-1')).toBe('account-1');
    expect(canonicalObjects.CanonicalConsentId('consent-1')).toBe('consent-1');
    expect(canonicalObjects.CanonicalPrivacyPolicyId('policy-1')).toBe('policy-1');
  });

  it('does not expose parser surfaces from the compatibility barrel', () => {
    expect(canonicalObjects).not.toHaveProperty('parsePartyV1');
    expect(canonicalObjects).not.toHaveProperty('parseConsentV1');
    expect(canonicalObjects).not.toHaveProperty('parsePrivacyPolicyV1');
  });
});
