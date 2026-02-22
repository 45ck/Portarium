import { describe, expect, it } from 'vitest';

import {
  deriveAgentCredentialBoundaryStatus,
  parseAgentCredentialBoundaryV1,
} from './agent-credential-boundary-v1.js';

const VALID_MINIMAL = {
  schemaVersion: 1,
  boundaryId: 'acb-1',
  agentId: 'agent-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  grants: [
    {
      credentialGrantId: 'cg-1',
      adapterId: 'adapter-1',
      effectiveScope: 'read:invoices',
    },
  ],
  issuedAtIso: '2026-01-01T00:00:00.000Z',
  expiresAtIso: '2026-01-01T01:00:00.000Z',
} as const;

describe('parseAgentCredentialBoundaryV1', () => {
  it('parses a valid minimal boundary', () => {
    const boundary = parseAgentCredentialBoundaryV1(VALID_MINIMAL);

    expect(boundary.schemaVersion).toBe(1);
    expect(boundary.boundaryId).toBe('acb-1');
    expect(boundary.agentId).toBe('agent-1');
    expect(boundary.runId).toBe('run-1');
    expect(boundary.workspaceId).toBe('ws-1');
    expect(boundary.grants).toHaveLength(1);
    expect(boundary.grants[0]!.credentialGrantId).toBe('cg-1');
    expect(boundary.grants[0]!.adapterId).toBe('adapter-1');
    expect(boundary.grants[0]!.effectiveScope).toBe('read:invoices');
    expect(boundary.issuedAtIso).toBe('2026-01-01T00:00:00.000Z');
    expect(boundary.expiresAtIso).toBe('2026-01-01T01:00:00.000Z');
    expect(boundary.revokedAtIso).toBeUndefined();
  });

  it('parses a boundary with multiple grants', () => {
    const boundary = parseAgentCredentialBoundaryV1({
      ...VALID_MINIMAL,
      grants: [
        { credentialGrantId: 'cg-1', adapterId: 'adapter-1', effectiveScope: 'read:invoices' },
        { credentialGrantId: 'cg-2', adapterId: 'adapter-2', effectiveScope: 'write:orders' },
      ],
    });

    expect(boundary.grants).toHaveLength(2);
    expect(boundary.grants[1]!.credentialGrantId).toBe('cg-2');
  });

  it('parses a revoked boundary', () => {
    const boundary = parseAgentCredentialBoundaryV1({
      ...VALID_MINIMAL,
      revokedAtIso: '2026-01-01T00:30:00.000Z',
    });

    expect(boundary.revokedAtIso).toBe('2026-01-01T00:30:00.000Z');
  });

  it('rejects non-object values', () => {
    expect(() => parseAgentCredentialBoundaryV1(null)).toThrow(/must be an object/);
    expect(() => parseAgentCredentialBoundaryV1('string')).toThrow(/must be an object/);
    expect(() => parseAgentCredentialBoundaryV1(42)).toThrow(/must be an object/);
  });

  it('rejects wrong schemaVersion', () => {
    expect(() => parseAgentCredentialBoundaryV1({ ...VALID_MINIMAL, schemaVersion: 2 })).toThrow(
      /schemaVersion must be 1/,
    );
  });

  it('rejects missing required fields', () => {
    const { boundaryId: _drop, ...withoutBoundaryId } = VALID_MINIMAL;
    expect(() => parseAgentCredentialBoundaryV1(withoutBoundaryId)).toThrow(
      /boundaryId must be a non-empty string/,
    );

    const { agentId: _drop2, ...withoutAgentId } = VALID_MINIMAL;
    expect(() => parseAgentCredentialBoundaryV1(withoutAgentId)).toThrow(
      /agentId must be a non-empty string/,
    );

    const { runId: _drop3, ...withoutRunId } = VALID_MINIMAL;
    expect(() => parseAgentCredentialBoundaryV1(withoutRunId)).toThrow(
      /runId must be a non-empty string/,
    );
  });

  it('rejects empty grants array', () => {
    expect(() => parseAgentCredentialBoundaryV1({ ...VALID_MINIMAL, grants: [] })).toThrow(
      /grants must be a non-empty array/,
    );
  });

  it('rejects non-array grants', () => {
    expect(() => parseAgentCredentialBoundaryV1({ ...VALID_MINIMAL, grants: 'not-array' })).toThrow(
      /grants must be a non-empty array/,
    );
  });

  it('rejects duplicate credentialGrantId within grants', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({
        ...VALID_MINIMAL,
        grants: [
          { credentialGrantId: 'cg-1', adapterId: 'adapter-1', effectiveScope: 'read:invoices' },
          { credentialGrantId: 'cg-1', adapterId: 'adapter-2', effectiveScope: 'write:orders' },
        ],
      }),
    ).toThrow(/duplicate credentialGrantId/);
  });

  it('rejects a grant entry that is not an object', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({
        ...VALID_MINIMAL,
        grants: ['not-an-object'],
      }),
    ).toThrow(/must be an object/);
  });

  it('rejects empty effectiveScope', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({
        ...VALID_MINIMAL,
        grants: [{ credentialGrantId: 'cg-1', adapterId: 'adapter-1', effectiveScope: '   ' }],
      }),
    ).toThrow(/effectiveScope must be a non-empty string/);
  });

  it('rejects expiresAtIso before issuedAtIso', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({
        ...VALID_MINIMAL,
        issuedAtIso: '2026-06-01T00:00:00.000Z',
        expiresAtIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(/expiresAtIso must not precede issuedAtIso/);
  });

  it('rejects revokedAtIso before issuedAtIso', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({
        ...VALID_MINIMAL,
        issuedAtIso: '2026-06-01T00:00:00.000Z',
        expiresAtIso: '2026-12-01T00:00:00.000Z',
        revokedAtIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow(/revokedAtIso must not precede issuedAtIso/);
  });

  it('rejects invalid ISO timestamp', () => {
    expect(() =>
      parseAgentCredentialBoundaryV1({ ...VALID_MINIMAL, issuedAtIso: 'not-a-date' }),
    ).toThrow(/issuedAtIso must be a valid ISO timestamp/);

    expect(() => parseAgentCredentialBoundaryV1({ ...VALID_MINIMAL, expiresAtIso: 'bad' })).toThrow(
      /expiresAtIso must be a valid ISO timestamp/,
    );
  });
});

describe('deriveAgentCredentialBoundaryStatus', () => {
  const baseBoundary = parseAgentCredentialBoundaryV1(VALID_MINIMAL);

  it('returns Active for a non-expired, non-revoked boundary', () => {
    const status = deriveAgentCredentialBoundaryStatus(
      baseBoundary,
      new Date('2026-01-01T00:30:00.000Z'),
    );
    expect(status).toBe('Active');
  });

  it('returns Expired when past expiresAtIso', () => {
    const status = deriveAgentCredentialBoundaryStatus(
      baseBoundary,
      new Date('2026-01-01T02:00:00.000Z'),
    );
    expect(status).toBe('Expired');
  });

  it('returns Revoked when revokedAtIso is set', () => {
    const revoked = parseAgentCredentialBoundaryV1({
      ...VALID_MINIMAL,
      revokedAtIso: '2026-01-01T00:15:00.000Z',
    });
    const status = deriveAgentCredentialBoundaryStatus(
      revoked,
      new Date('2026-01-01T00:10:00.000Z'),
    );
    expect(status).toBe('Revoked');
  });

  it('returns Revoked (not Expired) when both revoked and past expiry', () => {
    const revoked = parseAgentCredentialBoundaryV1({
      ...VALID_MINIMAL,
      revokedAtIso: '2026-01-01T00:15:00.000Z',
    });
    const status = deriveAgentCredentialBoundaryStatus(
      revoked,
      new Date('2026-01-01T02:00:00.000Z'),
    );
    expect(status).toBe('Revoked');
  });

  it('returns Expired at exact expiry time', () => {
    const status = deriveAgentCredentialBoundaryStatus(
      baseBoundary,
      new Date('2026-01-01T01:00:00.000Z'),
    );
    expect(status).toBe('Expired');
  });
});
