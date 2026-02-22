/**
 * Evidence durability policy V1 — domain invariant suite (bead-f908).
 *
 * Tests:
 *   1. Parse valid policies for all retention classes
 *   2. Domain invariants: Forensic → prohibition, legalHold enforcement
 *   3. Guard functions: isDeletionPermitted, requiresChainHash, requiresSignature
 *   4. Canonical default policy constants
 *   5. Parse error for malformed input
 */

import { describe, expect, it } from 'vitest';

import {
  COMPLIANCE_DURABILITY_POLICY,
  EvidenceDurabilityPolicyParseError,
  FORENSIC_DURABILITY_POLICY,
  OPERATIONAL_DURABILITY_POLICY,
  isDeletionPermitted,
  parseEvidenceDurabilityPolicyV1,
  requiresChainHash,
  requiresSignature,
} from './evidence-durability-policy-v1.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function validPolicy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    retentionClass: 'Compliance',
    tamperEvidenceLevel: 'chain-hash',
    exportPermitted: true,
    preferredExportFormat: 'json-lines',
    deletionPolicy: 'on-request',
    legalHoldSuspendsDeletion: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// I. Parsing — valid policies
// ---------------------------------------------------------------------------

describe('parseEvidenceDurabilityPolicyV1 — valid policies', () => {
  it('parses a valid Operational policy', () => {
    const result = parseEvidenceDurabilityPolicyV1(
      validPolicy({
        retentionClass: 'Operational',
        tamperEvidenceLevel: 'hash-only',
        deletionPolicy: 'after-retention',
      }),
    );
    expect(result.schemaVersion).toBe(1);
    expect(result.retentionClass).toBe('Operational');
    expect(result.tamperEvidenceLevel).toBe('hash-only');
    expect(result.deletionPolicy).toBe('after-retention');
  });

  it('parses a valid Compliance policy', () => {
    const result = parseEvidenceDurabilityPolicyV1(validPolicy());
    expect(result.retentionClass).toBe('Compliance');
    expect(result.tamperEvidenceLevel).toBe('chain-hash');
    expect(result.exportPermitted).toBe(true);
    expect(result.preferredExportFormat).toBe('json-lines');
    expect(result.deletionPolicy).toBe('on-request');
    expect(result.legalHoldSuspendsDeletion).toBe(true);
  });

  it('parses a valid Forensic policy with prohibited deletion', () => {
    const result = parseEvidenceDurabilityPolicyV1(
      validPolicy({
        retentionClass: 'Forensic',
        tamperEvidenceLevel: 'signed-chain',
        deletionPolicy: 'prohibited',
        preferredExportFormat: 'pdf-audit',
      }),
    );
    expect(result.retentionClass).toBe('Forensic');
    expect(result.deletionPolicy).toBe('prohibited');
    expect(result.tamperEvidenceLevel).toBe('signed-chain');
  });

  it('parses policy with exportPermitted=false', () => {
    const result = parseEvidenceDurabilityPolicyV1(
      validPolicy({ deletionPolicy: 'prohibited', exportPermitted: false }),
    );
    expect(result.exportPermitted).toBe(false);
  });

  it('accepts csv as export format', () => {
    const result = parseEvidenceDurabilityPolicyV1(
      validPolicy({ preferredExportFormat: 'csv', deletionPolicy: 'prohibited' }),
    );
    expect(result.preferredExportFormat).toBe('csv');
  });
});

// ---------------------------------------------------------------------------
// II. Domain invariants — parse-time enforcement
// ---------------------------------------------------------------------------

describe('parseEvidenceDurabilityPolicyV1 — domain invariants', () => {
  it('rejects Forensic retention class with deletionPolicy=after-retention', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ retentionClass: 'Forensic', deletionPolicy: 'after-retention' }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('rejects Forensic retention class with deletionPolicy=on-request', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ retentionClass: 'Forensic', deletionPolicy: 'on-request' }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('rejects deletionPolicy=after-retention when legalHoldSuspendsDeletion=false', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({
          deletionPolicy: 'after-retention',
          legalHoldSuspendsDeletion: false,
        }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('rejects deletionPolicy=on-request when legalHoldSuspendsDeletion=false', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({
          deletionPolicy: 'on-request',
          legalHoldSuspendsDeletion: false,
        }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('allows prohibited deletion with legalHoldSuspendsDeletion=false (legal hold irrelevant)', () => {
    const result = parseEvidenceDurabilityPolicyV1(
      validPolicy({
        deletionPolicy: 'prohibited',
        legalHoldSuspendsDeletion: false,
      }),
    );
    expect(result.deletionPolicy).toBe('prohibited');
  });

  it('error message references Forensic/prohibited for Forensic violation', () => {
    try {
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ retentionClass: 'Forensic', deletionPolicy: 'after-retention' }),
      );
      expect.fail('Should have thrown');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain('Forensic');
      expect(msg).toContain('prohibited');
    }
  });
});

// ---------------------------------------------------------------------------
// III. Parse error — malformed input
// ---------------------------------------------------------------------------

describe('parseEvidenceDurabilityPolicyV1 — parse errors', () => {
  it('throws for non-object input', () => {
    expect(() => parseEvidenceDurabilityPolicyV1('bad')).toThrow(
      EvidenceDurabilityPolicyParseError,
    );
  });

  it('throws for unknown retentionClass', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(validPolicy({ retentionClass: 'Archive' })),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('throws for unknown tamperEvidenceLevel', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ tamperEvidenceLevel: 'quantum', deletionPolicy: 'prohibited' }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('throws for unknown deletionPolicy', () => {
    expect(() => parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'shred' }))).toThrow(
      EvidenceDurabilityPolicyParseError,
    );
  });

  it('throws for unknown preferredExportFormat', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ preferredExportFormat: 'xml', deletionPolicy: 'prohibited' }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });

  it('throws when exportPermitted is not a boolean', () => {
    expect(() =>
      parseEvidenceDurabilityPolicyV1(
        validPolicy({ exportPermitted: 'yes', deletionPolicy: 'prohibited' }),
      ),
    ).toThrow(EvidenceDurabilityPolicyParseError);
  });
});

// ---------------------------------------------------------------------------
// IV. isDeletionPermitted guard
// ---------------------------------------------------------------------------

describe('isDeletionPermitted', () => {
  it('returns false when policy is prohibited (regardless of other conditions)', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ deletionPolicy: 'prohibited', legalHoldSuspendsDeletion: false }),
    );
    expect(isDeletionPermitted(policy, { retentionExpired: true, legalHoldActive: false })).toBe(
      false,
    );
    expect(isDeletionPermitted(policy, { retentionExpired: true, legalHoldActive: true })).toBe(
      false,
    );
    expect(isDeletionPermitted(policy, { retentionExpired: false, legalHoldActive: false })).toBe(
      false,
    );
  });

  it('returns false when legal hold is active and legalHoldSuspendsDeletion=true', () => {
    const policy = parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'on-request' }));
    expect(isDeletionPermitted(policy, { retentionExpired: true, legalHoldActive: true })).toBe(
      false,
    );
  });

  it('returns false when retention has not expired', () => {
    const policy = parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'on-request' }));
    expect(isDeletionPermitted(policy, { retentionExpired: false, legalHoldActive: false })).toBe(
      false,
    );
  });

  it('returns true when deletion is on-request, retention expired, no legal hold', () => {
    const policy = parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'on-request' }));
    expect(isDeletionPermitted(policy, { retentionExpired: true, legalHoldActive: false })).toBe(
      true,
    );
  });

  it('returns true when deletion is after-retention, retention expired, no legal hold', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ deletionPolicy: 'after-retention' }),
    );
    expect(isDeletionPermitted(policy, { retentionExpired: true, legalHoldActive: false })).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// V. requiresChainHash and requiresSignature guards
// ---------------------------------------------------------------------------

describe('requiresChainHash', () => {
  it('returns false for hash-only', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ tamperEvidenceLevel: 'hash-only', deletionPolicy: 'prohibited' }),
    );
    expect(requiresChainHash(policy)).toBe(false);
  });

  it('returns true for chain-hash', () => {
    const policy = parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'prohibited' }));
    expect(requiresChainHash(policy)).toBe(true);
  });

  it('returns true for signed-chain', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ tamperEvidenceLevel: 'signed-chain', deletionPolicy: 'prohibited' }),
    );
    expect(requiresChainHash(policy)).toBe(true);
  });
});

describe('requiresSignature', () => {
  it('returns false for hash-only', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ tamperEvidenceLevel: 'hash-only', deletionPolicy: 'prohibited' }),
    );
    expect(requiresSignature(policy)).toBe(false);
  });

  it('returns false for chain-hash', () => {
    const policy = parseEvidenceDurabilityPolicyV1(validPolicy({ deletionPolicy: 'prohibited' }));
    expect(requiresSignature(policy)).toBe(false);
  });

  it('returns true for signed-chain', () => {
    const policy = parseEvidenceDurabilityPolicyV1(
      validPolicy({ tamperEvidenceLevel: 'signed-chain', deletionPolicy: 'prohibited' }),
    );
    expect(requiresSignature(policy)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VI. Canonical default policy constants
// ---------------------------------------------------------------------------

describe('canonical default policies', () => {
  it('OPERATIONAL_DURABILITY_POLICY has correct defaults', () => {
    expect(OPERATIONAL_DURABILITY_POLICY.retentionClass).toBe('Operational');
    expect(OPERATIONAL_DURABILITY_POLICY.tamperEvidenceLevel).toBe('chain-hash');
    expect(OPERATIONAL_DURABILITY_POLICY.exportPermitted).toBe(true);
    expect(OPERATIONAL_DURABILITY_POLICY.deletionPolicy).toBe('after-retention');
    expect(OPERATIONAL_DURABILITY_POLICY.legalHoldSuspendsDeletion).toBe(true);
    expect(OPERATIONAL_DURABILITY_POLICY.schemaVersion).toBe(1);
  });

  it('COMPLIANCE_DURABILITY_POLICY has correct defaults', () => {
    expect(COMPLIANCE_DURABILITY_POLICY.retentionClass).toBe('Compliance');
    expect(COMPLIANCE_DURABILITY_POLICY.tamperEvidenceLevel).toBe('chain-hash');
    expect(COMPLIANCE_DURABILITY_POLICY.deletionPolicy).toBe('on-request');
    expect(COMPLIANCE_DURABILITY_POLICY.legalHoldSuspendsDeletion).toBe(true);
  });

  it('FORENSIC_DURABILITY_POLICY has correct defaults', () => {
    expect(FORENSIC_DURABILITY_POLICY.retentionClass).toBe('Forensic');
    expect(FORENSIC_DURABILITY_POLICY.tamperEvidenceLevel).toBe('signed-chain');
    expect(FORENSIC_DURABILITY_POLICY.deletionPolicy).toBe('prohibited');
    expect(FORENSIC_DURABILITY_POLICY.preferredExportFormat).toBe('pdf-audit');
  });

  it('all canonical defaults satisfy their own domain invariants (re-parse)', () => {
    expect(() => parseEvidenceDurabilityPolicyV1(OPERATIONAL_DURABILITY_POLICY)).not.toThrow();
    expect(() => parseEvidenceDurabilityPolicyV1(COMPLIANCE_DURABILITY_POLICY)).not.toThrow();
    expect(() => parseEvidenceDurabilityPolicyV1(FORENSIC_DURABILITY_POLICY)).not.toThrow();
  });

  it('Forensic default is never deletable (regardless of retention/hold)', () => {
    expect(
      isDeletionPermitted(FORENSIC_DURABILITY_POLICY, {
        retentionExpired: true,
        legalHoldActive: false,
      }),
    ).toBe(false);
    expect(
      isDeletionPermitted(FORENSIC_DURABILITY_POLICY, {
        retentionExpired: true,
        legalHoldActive: true,
      }),
    ).toBe(false);
  });

  it('Operational default is deletable after retention expires with no legal hold', () => {
    expect(
      isDeletionPermitted(OPERATIONAL_DURABILITY_POLICY, {
        retentionExpired: true,
        legalHoldActive: false,
      }),
    ).toBe(true);
  });
});
