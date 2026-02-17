import { describe, expect, it } from 'vitest';

import { parsePackComplianceProfileV1 } from './pack-compliance-profile-v1.js';

const VALID_COMPLIANCE_PROFILE = {
  schemaVersion: 1,
  profileId: 'prof-001',
  packId: 'scm.change-management',
  namespace: 'scm',
  jurisdiction: 'EU-GDPR',
  constraints: [
    { constraintId: 'c-1', rule: 'data-retention-90d', severity: 'high' },
    { constraintId: 'c-2', rule: 'encryption-at-rest', severity: 'critical' },
  ],
};

describe('parsePackComplianceProfileV1: happy path', () => {
  it('parses a valid v1 compliance profile', () => {
    const prof = parsePackComplianceProfileV1(VALID_COMPLIANCE_PROFILE);

    expect(prof.schemaVersion).toBe(1);
    expect(prof.profileId).toBe('prof-001');
    expect(prof.packId).toBe('scm.change-management');
    expect(prof.namespace).toBe('scm');
    expect(prof.jurisdiction).toBe('EU-GDPR');
    expect(prof.constraints).toHaveLength(2);
    expect(prof.constraints[0]!.constraintId).toBe('c-1');
    expect(prof.constraints[1]!.severity).toBe('critical');
  });
});

describe('parsePackComplianceProfileV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parsePackComplianceProfileV1(null)).toThrow(/must be an object/);
    expect(() => parsePackComplianceProfileV1([])).toThrow(/must be an object/);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() =>
      parsePackComplianceProfileV1({ ...VALID_COMPLIANCE_PROFILE, schemaVersion: 2 }),
    ).toThrow(/Unsupported schemaVersion/);
  });

  it('rejects non-array constraints', () => {
    expect(() =>
      parsePackComplianceProfileV1({ ...VALID_COMPLIANCE_PROFILE, constraints: 'oops' }),
    ).toThrow(/constraints must be an array/);
  });

  it('rejects non-object constraint entry', () => {
    expect(() =>
      parsePackComplianceProfileV1({ ...VALID_COMPLIANCE_PROFILE, constraints: [42] }),
    ).toThrow(/constraints\[0\] must be an object/);
  });

  it('rejects missing required string fields', () => {
    expect(() =>
      parsePackComplianceProfileV1({ ...VALID_COMPLIANCE_PROFILE, profileId: '' }),
    ).toThrow(/profileId must be a non-empty string/);

    expect(() =>
      parsePackComplianceProfileV1({ ...VALID_COMPLIANCE_PROFILE, jurisdiction: 123 }),
    ).toThrow(/jurisdiction must be a non-empty string/);
  });

  it('rejects missing constraint fields', () => {
    expect(() =>
      parsePackComplianceProfileV1({
        ...VALID_COMPLIANCE_PROFILE,
        constraints: [{ constraintId: 'c-1', rule: 'x' }],
      }),
    ).toThrow(/severity must be a non-empty string/);
  });
});
