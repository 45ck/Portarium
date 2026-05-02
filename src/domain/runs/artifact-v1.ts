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

const ARTIFACT_MEDIA_TYPES = ['gif', 'mp4', 'png'] as const;

export type ArtifactMediaRefType = (typeof ARTIFACT_MEDIA_TYPES)[number];

export type ArtifactMediaRefV1 = Readonly<{
  type: ArtifactMediaRefType;
  url: string;
  sha256: HashSha256Type;
}>;

export type ArtifactV1 = Readonly<{
  schemaVersion: 1;
  artifactId: ArtifactIdType;
  runId: RunIdType;
  evidenceId?: EvidenceIdType;
  mimeType: string;
  sizeBytes: number;
  storageRef: string;
  hashSha256: HashSha256Type;
  mediaRefs?: readonly ArtifactMediaRefV1[];
  retentionSchedule?: RetentionScheduleV1;
  createdAtIso: string;
  /**
   * Optional digital signature over the canonical JSON of this artifact
   * (all fields except `signatureBase64` itself).  Produced by an EvidenceSigner hook.
   */
  signatureBase64?: string;
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
  const mediaRefs = parseOptionalMediaRefs(record);
  const createdAtIso = readIsoString(record, 'createdAtIso', ArtifactParseError);
  const signatureBase64 = readOptionalString(record, 'signatureBase64', ArtifactParseError);

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
    ...(mediaRefs !== undefined ? { mediaRefs } : {}),
    ...(retentionSchedule !== undefined ? { retentionSchedule } : {}),
    createdAtIso,
    ...(signatureBase64 !== undefined ? { signatureBase64 } : {}),
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

function parseOptionalMediaRefs(
  obj: Record<string, unknown>,
): readonly ArtifactMediaRefV1[] | undefined {
  const raw = obj['mediaRefs'];
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new ArtifactParseError('mediaRefs must be an array when provided.');
  }

  return raw.map((item, index) => {
    const media = readRecord(item, `mediaRefs[${index}]`, ArtifactParseError);
    const type = parseMediaType(readString(media, 'type', ArtifactParseError));
    const url = readString(media, 'url', ArtifactParseError);
    const sha256 = HashSha256(readString(media, 'sha256', ArtifactParseError));
    return { type, url, sha256 };
  });
}

function parseMediaType(type: string): ArtifactMediaRefType {
  if (!ARTIFACT_MEDIA_TYPES.includes(type as ArtifactMediaRefType)) {
    throw new ArtifactParseError(
      `mediaRef type must be one of: ${ARTIFACT_MEDIA_TYPES.join(', ')}.`,
    );
  }
  return type as ArtifactMediaRefType;
}
