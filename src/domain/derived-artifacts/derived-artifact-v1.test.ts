import { describe, expect, it } from 'vitest';

import {
  parseDerivedArtifactV1,
  DerivedArtifactParseError,
  isDerivedArtifactExpired,
  isValidDerivedArtifactKind,
  DERIVED_ARTIFACT_KINDS,
} from './derived-artifact-v1.js';

const VALID_BASE = {
  schemaVersion: 1,
  artifactId: 'da-1',
  workspaceId: 'ws-1',
  kind: 'embedding',
  provenance: {
    workspaceId: 'ws-1',
    runId: 'run-1',
    projectorVersion: '1.0.0',
  },
  retentionPolicy: 'indefinite',
  createdAtIso: '2026-02-22T00:00:00.000Z',
} as const;

describe('parseDerivedArtifactV1: happy path', () => {
  it('parses a minimal embedding artefact', () => {
    const a = parseDerivedArtifactV1(VALID_BASE);
    expect(a.schemaVersion).toBe(1);
    expect(a.artifactId).toBe('da-1');
    expect(a.kind).toBe('embedding');
    expect(a.retentionPolicy).toBe('indefinite');
    expect(a.expiresAtIso).toBeUndefined();
  });

  it('parses all four kinds', () => {
    for (const kind of DERIVED_ARTIFACT_KINDS) {
      const a = parseDerivedArtifactV1({ ...VALID_BASE, kind });
      expect(a.kind).toBe(kind);
    }
  });

  it('parses TTL retention with expiresAtIso', () => {
    const a = parseDerivedArtifactV1({
      ...VALID_BASE,
      retentionPolicy: 'ttl',
      expiresAtIso: '2026-12-31T00:00:00.000Z',
    });
    expect(a.retentionPolicy).toBe('ttl');
    expect(a.expiresAtIso).toBe('2026-12-31T00:00:00.000Z');
  });

  it('parses provenance with optional evidenceId', () => {
    const a = parseDerivedArtifactV1({
      ...VALID_BASE,
      provenance: { ...VALID_BASE.provenance, evidenceId: 'ev-1' },
    });
    expect(a.provenance.evidenceId).toBe('ev-1');
  });

  it('parses run-lifetime retention', () => {
    const a = parseDerivedArtifactV1({ ...VALID_BASE, retentionPolicy: 'run-lifetime' });
    expect(a.retentionPolicy).toBe('run-lifetime');
  });
});

describe('parseDerivedArtifactV1: validation errors', () => {
  it('throws on unsupported schemaVersion', () => {
    expect(() => parseDerivedArtifactV1({ ...VALID_BASE, schemaVersion: 2 })).toThrow(
      DerivedArtifactParseError,
    );
  });

  it('throws on invalid kind', () => {
    expect(() => parseDerivedArtifactV1({ ...VALID_BASE, kind: 'pdf-export' })).toThrow(
      DerivedArtifactParseError,
    );
  });

  it('throws on invalid retentionPolicy', () => {
    expect(() =>
      parseDerivedArtifactV1({ ...VALID_BASE, retentionPolicy: 'forever' }),
    ).toThrow(DerivedArtifactParseError);
  });

  it('throws when ttl retention has no expiresAtIso', () => {
    expect(() =>
      parseDerivedArtifactV1({ ...VALID_BASE, retentionPolicy: 'ttl' }),
    ).toThrow(DerivedArtifactParseError);
  });

  it('throws when expiresAtIso is before createdAtIso', () => {
    expect(() =>
      parseDerivedArtifactV1({
        ...VALID_BASE,
        retentionPolicy: 'ttl',
        createdAtIso: '2026-02-22T12:00:00.000Z',
        expiresAtIso: '2026-02-22T10:00:00.000Z', // before createdAt
      }),
    ).toThrow(DerivedArtifactParseError);
  });

  it('throws when provenance is missing', () => {
    const { provenance: _, ...withoutProvenance } = VALID_BASE;
    expect(() => parseDerivedArtifactV1(withoutProvenance)).toThrow(DerivedArtifactParseError);
  });

  it('throws when provenance.runId is missing', () => {
    expect(() =>
      parseDerivedArtifactV1({
        ...VALID_BASE,
        provenance: { workspaceId: 'ws-1', projectorVersion: '1.0.0' },
      }),
    ).toThrow(DerivedArtifactParseError);
  });
});

describe('isDerivedArtifactExpired', () => {
  it('returns false for indefinite retention', () => {
    const a = parseDerivedArtifactV1(VALID_BASE);
    expect(isDerivedArtifactExpired(a, '2099-01-01T00:00:00.000Z')).toBe(false);
  });

  it('returns false when expiresAtIso is in the future', () => {
    const a = parseDerivedArtifactV1({
      ...VALID_BASE,
      retentionPolicy: 'ttl',
      expiresAtIso: '2026-12-31T00:00:00.000Z',
    });
    expect(isDerivedArtifactExpired(a, '2026-06-01T00:00:00.000Z')).toBe(false);
  });

  it('returns true when expiresAtIso is in the past', () => {
    const a = parseDerivedArtifactV1({
      ...VALID_BASE,
      retentionPolicy: 'ttl',
      expiresAtIso: '2026-03-01T00:00:00.000Z',
    });
    expect(isDerivedArtifactExpired(a, '2026-04-01T00:00:00.000Z')).toBe(true);
  });
});

describe('isValidDerivedArtifactKind', () => {
  it('returns true for all valid kinds', () => {
    for (const kind of DERIVED_ARTIFACT_KINDS) {
      expect(isValidDerivedArtifactKind(kind)).toBe(true);
    }
  });

  it('returns false for invalid kinds', () => {
    expect(isValidDerivedArtifactKind('pdf')).toBe(false);
    expect(isValidDerivedArtifactKind('')).toBe(false);
    expect(isValidDerivedArtifactKind('EMBEDDING')).toBe(false);
  });
});
