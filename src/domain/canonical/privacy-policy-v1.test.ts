import { describe, expect, it } from 'vitest';

import { PrivacyPolicyParseError, parsePrivacyPolicyV1 } from './privacy-policy-v1.js';

describe('parsePrivacyPolicyV1', () => {
  const valid = {
    privacyPolicyId: 'privacy-policy-1',
    tenantId: 'tenant-1',
    schemaVersion: 1,
    name: 'Marketing Communications Policy',
    versionLabel: '2026.02',
    effectiveFromIso: '2026-02-20T00:00:00.000Z',
    effectiveToIso: '2027-02-20T00:00:00.000Z',
    defaultOptInStatus: 'pending_double_opt_in',
    suppressionListNames: ['global-unsubscribes', 'litigation-hold'],
    auditRetentionDays: 365,
    policyDocumentUrl: 'https://docs.portarium.dev/privacy/marketing-2026-02',
    externalRefs: [
      {
        sorName: 'hubspot',
        portFamily: 'MarketingAutomation',
        externalId: 'privacy_policy_123',
        externalType: 'privacy_policy',
      },
    ],
  };

  it('parses a full PrivacyPolicyV1 payload', () => {
    const policy = parsePrivacyPolicyV1(valid);
    expect(policy.privacyPolicyId).toBe('privacy-policy-1');
    expect(policy.defaultOptInStatus).toBe('pending_double_opt_in');
    expect(policy.suppressionListNames).toEqual(['global-unsubscribes', 'litigation-hold']);
    expect(policy.externalRefs).toHaveLength(1);
  });

  it('parses a minimal PrivacyPolicyV1 payload', () => {
    const policy = parsePrivacyPolicyV1({
      privacyPolicyId: 'privacy-policy-2',
      tenantId: 'tenant-1',
      schemaVersion: 1,
      name: 'Default Policy',
      versionLabel: '1.0.0',
      effectiveFromIso: '2026-02-20T00:00:00.000Z',
      defaultOptInStatus: 'unknown',
    });

    expect(policy.effectiveToIso).toBeUndefined();
    expect(policy.suppressionListNames).toBeUndefined();
    expect(policy.auditRetentionDays).toBeUndefined();
    expect(policy.policyDocumentUrl).toBeUndefined();
  });

  it('rejects non-object payloads', () => {
    expect(() => parsePrivacyPolicyV1('nope')).toThrow(PrivacyPolicyParseError);
    expect(() => parsePrivacyPolicyV1(null)).toThrow(PrivacyPolicyParseError);
    expect(() => parsePrivacyPolicyV1([])).toThrow(PrivacyPolicyParseError);
  });

  it('rejects invalid defaultOptInStatus', () => {
    expect(() => parsePrivacyPolicyV1({ ...valid, defaultOptInStatus: 'enabled' })).toThrow(
      /defaultOptInStatus/,
    );
  });

  it('rejects effectiveToIso earlier than effectiveFromIso', () => {
    expect(() =>
      parsePrivacyPolicyV1({
        ...valid,
        effectiveToIso: '2026-02-19T00:00:00.000Z',
      }),
    ).toThrow(/effectiveToIso/);
  });

  it('rejects duplicate suppression list names', () => {
    expect(() =>
      parsePrivacyPolicyV1({
        ...valid,
        suppressionListNames: ['Global-Unsubscribes', 'global-unsubscribes'],
      }),
    ).toThrow(/duplicate value/);
  });

  it('rejects negative auditRetentionDays', () => {
    expect(() =>
      parsePrivacyPolicyV1({
        ...valid,
        auditRetentionDays: -1,
      }),
    ).toThrow(/auditRetentionDays/);
  });
});
