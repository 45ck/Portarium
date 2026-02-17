import {
  ArtifactId,
  EvidenceId,
  HashSha256,
  RunId,
  type ArtifactId as ArtifactIdType,
  type EvidenceId as EvidenceIdType,
  type HashSha256 as HashSha256Type,
  type RunId as RunIdType,
} from '../primitives/index.js';
import type { RetentionScheduleV1 } from '../evidence/retention-schedule-v1.js';
import { parseRetentionScheduleV1 } from '../evidence/retention-schedule-v1.js';

export type ArtifactV1 = Readonly<{
  schemaVersion: 1;
  artifactId: ArtifactIdType;
  runId: RunIdType;
  evidenceId?: EvidenceIdType;
  mimeType: string;
  sizeBytes: number;
  storageRef: string;
  hashSha256: HashSha256Type;
  retentionSchedule?: RetentionScheduleV1;
  createdAtIso: string;
}>;

export class ArtifactParseError extends Error {
  public override readonly name = 'ArtifactParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseArtifactV1(value: unknown): ArtifactV1 {
  if (!isRecord(value)) throw new ArtifactParseError('Artifact must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new ArtifactParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const artifactId = ArtifactId(readString(value, 'artifactId'));
  const runId = RunId(readString(value, 'runId'));
  const evidenceId = parseOptionalId(value, 'evidenceId', EvidenceId);
  const mimeType = readString(value, 'mimeType');
  const sizeBytes = readNonNegativeInteger(value, 'sizeBytes');
  const storageRef = readString(value, 'storageRef');
  const hashSha256 = HashSha256(readString(value, 'hashSha256'));
  const createdAtIso = readString(value, 'createdAtIso');

  const retentionScheduleRaw = value['retentionSchedule'];
  let retentionSchedule: RetentionScheduleV1 | undefined;
  if (retentionScheduleRaw !== undefined) {
    try {
      retentionSchedule = parseRetentionScheduleV1(retentionScheduleRaw);
    } catch {
      throw new ArtifactParseError('retentionSchedule is invalid.');
    }
  }

  return {
    schemaVersion: 1,
    artifactId,
    runId,
    ...(evidenceId !== undefined ? { evidenceId } : {}),
    mimeType,
    sizeBytes,
    storageRef,
    hashSha256,
    ...(retentionSchedule !== undefined ? { retentionSchedule } : {}),
    createdAtIso,
  };
}

function parseOptionalId<T>(
  obj: Record<string, unknown>,
  key: string,
  ctor: (raw: string) => T,
): T | undefined {
  const raw = readOptionalString(obj, key);
  return raw === undefined ? undefined : ctor(raw);
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ArtifactParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ArtifactParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new ArtifactParseError(`${key} must be an integer.`);
  }
  return v;
}

function readNonNegativeInteger(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
    throw new ArtifactParseError(`${key} must be a non-negative integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
