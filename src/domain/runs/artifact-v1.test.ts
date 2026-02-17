import { describe, expect, it } from 'vitest';

import { parseArtifactV1 } from './artifact-v1.js';

const VALID_ARTIFACT = {
  schemaVersion: 1,
  artifactId: 'art-1',
  runId: 'run-1',
  evidenceId: 'ev-1',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  storageRef: 's3://bucket/key',
  hashSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  retentionSchedule: {
    retentionClass: 'Compliance',
    retainUntilIso: '2030-12-31T23:59:59.000Z',
    legalHold: false,
  },
  createdAtIso: '2026-02-17T00:00:00.000Z',
};

describe('parseArtifactV1: happy path', () => {
  it('parses a full ArtifactV1 with all fields', () => {
    const artifact = parseArtifactV1(VALID_ARTIFACT);

    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.artifactId).toBe('art-1');
    expect(artifact.runId).toBe('run-1');
    expect(artifact.evidenceId).toBe('ev-1');
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.sizeBytes).toBe(1024);
    expect(artifact.storageRef).toBe('s3://bucket/key');
    expect(artifact.hashSha256).toBe(
      'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    );
    expect(artifact.retentionSchedule).toEqual({
      retentionClass: 'Compliance',
      retainUntilIso: '2030-12-31T23:59:59.000Z',
      legalHold: false,
    });
    expect(artifact.createdAtIso).toBe('2026-02-17T00:00:00.000Z');
  });

  it('parses with optional fields omitted', () => {
    const artifact = parseArtifactV1({
      schemaVersion: 1,
      artifactId: 'art-2',
      runId: 'run-2',
      mimeType: 'text/plain',
      sizeBytes: 0,
      storageRef: '/local/path/file.txt',
      hashSha256: '0000000000000000000000000000000000000000000000000000000000000000',
      createdAtIso: '2026-02-17T00:00:00.000Z',
    });

    expect(artifact.schemaVersion).toBe(1);
    expect(artifact.artifactId).toBe('art-2');
    expect(artifact.evidenceId).toBeUndefined();
    expect(artifact.sizeBytes).toBe(0);
    expect(artifact.retentionSchedule).toBeUndefined();
  });
});

describe('parseArtifactV1: validation', () => {
  it('rejects non-object input', () => {
    expect(() => parseArtifactV1('nope')).toThrow(/Artifact must be an object/i);
    expect(() => parseArtifactV1(null)).toThrow(/Artifact must be an object/i);
    expect(() => parseArtifactV1([])).toThrow(/Artifact must be an object/i);
  });

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, schemaVersion: 2 })).toThrow(
      /schemaVersion/i,
    );
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, schemaVersion: 1.5 })).toThrow(
      /schemaVersion/i,
    );
  });

  it('rejects missing required string fields', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, artifactId: undefined })).toThrow(
      /artifactId/i,
    );
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, runId: undefined })).toThrow(/runId/i);
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, mimeType: undefined })).toThrow(/mimeType/i);
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, storageRef: undefined })).toThrow(
      /storageRef/i,
    );
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, hashSha256: undefined })).toThrow(
      /hashSha256/i,
    );
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, createdAtIso: undefined })).toThrow(
      /createdAtIso/i,
    );
  });

  it('rejects blank string fields', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, artifactId: '   ' })).toThrow(/artifactId/i);
  });

  it('rejects invalid sizeBytes', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, sizeBytes: -1 })).toThrow(/sizeBytes/i);
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, sizeBytes: 1.5 })).toThrow(/sizeBytes/i);
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, sizeBytes: 'big' })).toThrow(/sizeBytes/i);
  });

  it('rejects invalid evidenceId when provided', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, evidenceId: '' })).toThrow(/evidenceId/i);
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, evidenceId: 123 })).toThrow(/evidenceId/i);
  });

  it('rejects invalid retentionSchedule', () => {
    expect(() => parseArtifactV1({ ...VALID_ARTIFACT, retentionSchedule: 'not-object' })).toThrow(
      /retentionSchedule/i,
    );
    expect(() =>
      parseArtifactV1({
        ...VALID_ARTIFACT,
        retentionSchedule: { retentionClass: 'Invalid' },
      }),
    ).toThrow(/retentionSchedule/i);
  });
});
