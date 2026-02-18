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
import {
  readInteger,
  readIsoString,
  readNonNegativeInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Artifact', ArtifactParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ArtifactParseError);
  if (schemaVersion !== 1) {
    throw new ArtifactParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const artifactId = ArtifactId(readString(record, 'artifactId', ArtifactParseError));
  const runId = RunId(readString(record, 'runId', ArtifactParseError));
  const evidenceId = parseOptionalId(record, 'evidenceId', EvidenceId);
  const mimeType = readString(record, 'mimeType', ArtifactParseError);
  const sizeBytes = readNonNegativeInteger(record, 'sizeBytes', ArtifactParseError);
  const storageRef = readString(record, 'storageRef', ArtifactParseError);
  const hashSha256 = HashSha256(readString(record, 'hashSha256', ArtifactParseError));
  const createdAtIso = readIsoString(record, 'createdAtIso', ArtifactParseError);

  const retentionScheduleRaw = record['retentionSchedule'];
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
  const raw = readOptionalString(obj, key, ArtifactParseError);
  return raw === undefined ? undefined : ctor(raw);
}
