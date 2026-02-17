import { describe, expect, it } from 'vitest';

import { deriveCredentialGrantStatus, parseCredentialGrantV1 } from './credential-grant-v1.js';

describe('parseCredentialGrantV1', () => {
  const validMinimal = {
    schemaVersion: 1,
    credentialGrantId: 'cg-1',
    workspaceId: 'ws-1',
    adapterId: 'adapter-1',
    credentialsRef: 'vault://secrets/cg-1',
    scope: 'read:invoices',
    issuedAtIso: '2026-01-01T00:00:00.000Z',
  };

  it('parses a valid minimal grant', () => {
    const grant = parseCredentialGrantV1(validMinimal);

    expect(grant.schemaVersion).toBe(1);
    expect(grant.credentialGrantId).toBe('cg-1');
    expect(grant.workspaceId).toBe('ws-1');
    expect(grant.adapterId).toBe('adapter-1');
    expect(grant.credentialsRef).toBe('vault://secrets/cg-1');
    expect(grant.scope).toBe('read:invoices');
    expect(grant.issuedAtIso).toBe('2026-01-01T00:00:00.000Z');
    expect(grant.expiresAtIso).toBeUndefined();
    expect(grant.lastRotatedAtIso).toBeUndefined();
    expect(grant.revokedAtIso).toBeUndefined();
  });

  it('parses a valid grant with all optional fields', () => {
    const grant = parseCredentialGrantV1({
      ...validMinimal,
      expiresAtIso: '2027-01-01T00:00:00.000Z',
      lastRotatedAtIso: '2026-06-01T00:00:00.000Z',
      revokedAtIso: '2026-12-01T00:00:00.000Z',
    });

    expect(grant.expiresAtIso).toBe('2027-01-01T00:00:00.000Z');
    expect(grant.lastRotatedAtIso).toBe('2026-06-01T00:00:00.000Z');
    expect(grant.revokedAtIso).toBe('2026-12-01T00:00:00.000Z');
  });

  it('rejects non-object values', () => {
    expect(() => parseCredentialGrantV1(null)).toThrow(/must be an object/);
    expect(() => parseCredentialGrantV1('string')).toThrow(/must be an object/);
    expect(() => parseCredentialGrantV1(42)).toThrow(/must be an object/);
  });

  it('rejects wrong schemaVersion', () => {
    expect(() => parseCredentialGrantV1({ ...validMinimal, schemaVersion: 2 })).toThrow(
      /schemaVersion must be 1/,
    );
  });

  it('rejects missing required fields', () => {
    const missing = { ...validMinimal } as Record<string, unknown>;
    delete missing['credentialGrantId'];
    expect(() => parseCredentialGrantV1(missing)).toThrow(
      /credentialGrantId must be a non-empty string/,
    );
  });

  it('rejects revokedAtIso before issuedAtIso', () => {
    expect(() =>
      parseCredentialGrantV1({
        ...validMinimal,
        issuedAtIso: '2026-06-01T00:00:00.000Z',
        revokedAtIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(/revokedAtIso must not precede issuedAtIso/);
  });

  it('rejects invalid ISO timestamp for issuedAtIso', () => {
    expect(() =>
      parseCredentialGrantV1({
        ...validMinimal,
        issuedAtIso: 'not-a-date',
      }),
    ).toThrow(/issuedAtIso must be a valid ISO timestamp/);
  });

  it('rejects invalid ISO timestamp for optional ISO fields', () => {
    expect(() =>
      parseCredentialGrantV1({
        ...validMinimal,
        expiresAtIso: 'not-a-date',
      }),
    ).toThrow(/expiresAtIso must be a valid ISO timestamp/);

    expect(() =>
      parseCredentialGrantV1({
        ...validMinimal,
        lastRotatedAtIso: 'not-a-date',
      }),
    ).toThrow(/lastRotatedAtIso must be a valid ISO timestamp/);

    expect(() =>
      parseCredentialGrantV1({
        ...validMinimal,
        revokedAtIso: 'not-a-date',
      }),
    ).toThrow(/revokedAtIso must be a valid ISO timestamp/);
  });
});

describe('deriveCredentialGrantStatus', () => {
  const baseGrant = parseCredentialGrantV1({
    schemaVersion: 1,
    credentialGrantId: 'cg-1',
    workspaceId: 'ws-1',
    adapterId: 'adapter-1',
    credentialsRef: 'vault://secrets/cg-1',
    scope: 'read:invoices',
    issuedAtIso: '2026-01-01T00:00:00.000Z',
  });

  it('returns Revoked when revokedAtIso is set', () => {
    const grant = parseCredentialGrantV1({
      schemaVersion: 1,
      credentialGrantId: 'cg-1',
      workspaceId: 'ws-1',
      adapterId: 'adapter-1',
      credentialsRef: 'vault://secrets/cg-1',
      scope: 'read:invoices',
      issuedAtIso: '2026-01-01T00:00:00.000Z',
      revokedAtIso: '2026-06-01T00:00:00.000Z',
    });
    expect(deriveCredentialGrantStatus(grant, new Date('2026-03-01T00:00:00.000Z'))).toBe(
      'Revoked',
    );
  });

  it('returns Expired when past expiresAtIso', () => {
    const grant = parseCredentialGrantV1({
      schemaVersion: 1,
      credentialGrantId: 'cg-1',
      workspaceId: 'ws-1',
      adapterId: 'adapter-1',
      credentialsRef: 'vault://secrets/cg-1',
      scope: 'read:invoices',
      issuedAtIso: '2026-01-01T00:00:00.000Z',
      expiresAtIso: '2026-06-01T00:00:00.000Z',
    });
    expect(deriveCredentialGrantStatus(grant, new Date('2026-07-01T00:00:00.000Z'))).toBe(
      'Expired',
    );
  });

  it('returns Active for valid non-expired grant', () => {
    expect(deriveCredentialGrantStatus(baseGrant, new Date('2026-03-01T00:00:00.000Z'))).toBe(
      'Active',
    );
  });
});
