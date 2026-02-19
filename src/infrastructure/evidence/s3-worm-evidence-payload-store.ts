import type { S3Client } from '@aws-sdk/client-s3';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  PutObjectLegalHoldCommand,
  PutObjectRetentionCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

import type { EvidencePayloadStorePort } from '../../application/ports/evidence-payload-store.js';
import {
  EvidencePayloadAlreadyExistsError,
  EvidencePayloadDeletionBlockedError,
  type EvidencePayloadLocation,
} from '../../application/ports/evidence-payload-store.js';
import type { RetentionScheduleV1 } from '../../domain/evidence/retention-schedule-v1.js';

function lockModeFor(schedule: RetentionScheduleV1): 'GOVERNANCE' | 'COMPLIANCE' {
  return schedule.retentionClass === 'Operational' ? 'GOVERNANCE' : 'COMPLIANCE';
}

function retainUntilDate(schedule: RetentionScheduleV1): Date | undefined {
  if (schedule.retainUntilIso === undefined) return undefined;
  const ms = Date.parse(schedule.retainUntilIso);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms);
}

function isS3AlreadyExistsError(error: unknown): boolean {
  // S3 responds with 412 PreconditionFailed when If-None-Match: "*" is used and the key exists.
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  if (name === 'PreconditionFailed') return true;
  const $metadata = (error as { $metadata?: unknown }).$metadata;
  if (typeof $metadata === 'object' && $metadata !== null) {
    const httpStatusCode = ($metadata as { httpStatusCode?: unknown }).httpStatusCode;
    if (httpStatusCode === 412) return true;
  }
  return false;
}

function isS3DeletionBlockedError(error: unknown): boolean {
  // When Object Lock blocks deletion, S3 commonly returns AccessDenied.
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  if (name === 'AccessDenied') return true;
  const $metadata = (error as { $metadata?: unknown }).$metadata;
  if (typeof $metadata === 'object' && $metadata !== null) {
    const httpStatusCode = ($metadata as { httpStatusCode?: unknown }).httpStatusCode;
    if (httpStatusCode === 403) return true;
  }
  return false;
}

export class S3WormEvidencePayloadStore implements EvidencePayloadStorePort {
  readonly #s3: S3Client;

  public constructor(params: Readonly<{ s3: S3Client }>) {
    this.#s3 = params.s3;
  }

  public async put(params: Readonly<{ location: EvidencePayloadLocation; bytes: Uint8Array }>) {
    try {
      const input: PutObjectCommandInput = {
        Bucket: params.location.bucket,
        Key: params.location.key,
        Body: params.bytes,
        // Enforce write-once at the storage API level even when bucket Object Lock
        // isn't configured (defense-in-depth).
        IfNoneMatch: '*',
      };
      await this.#s3.send(new PutObjectCommand(input));
    } catch (error) {
      if (isS3AlreadyExistsError(error)) {
        throw new EvidencePayloadAlreadyExistsError(
          `Evidence payload already exists at ${params.location.bucket}/${params.location.key}.`,
        );
      }
      throw error;
    }
  }

  public async applyWormControls(
    params: Readonly<{
      location: EvidencePayloadLocation;
      retentionSchedule: RetentionScheduleV1;
    }>,
  ) {
    const retainUntil = retainUntilDate(params.retentionSchedule);
    const mode = lockModeFor(params.retentionSchedule);

    if (retainUntil !== undefined) {
      await this.#s3.send(
        new PutObjectRetentionCommand({
          Bucket: params.location.bucket,
          Key: params.location.key,
          Retention: { Mode: mode, RetainUntilDate: retainUntil },
        }),
      );
    }

    if (params.retentionSchedule.legalHold !== undefined) {
      await this.#s3.send(
        new PutObjectLegalHoldCommand({
          Bucket: params.location.bucket,
          Key: params.location.key,
          LegalHold: { Status: params.retentionSchedule.legalHold === true ? 'ON' : 'OFF' },
        }),
      );
    }
  }

  public async delete(params: Readonly<{ location: EvidencePayloadLocation }>) {
    try {
      await this.#s3.send(
        new DeleteObjectCommand({ Bucket: params.location.bucket, Key: params.location.key }),
      );
    } catch (error) {
      if (isS3DeletionBlockedError(error)) {
        // We can't reliably distinguish "legal hold" vs "retention active" from the SDK error
        // without parsing XML bodies. Surface a conservative reason.
        throw new EvidencePayloadDeletionBlockedError(
          `Deletion blocked by Object Lock controls for ${params.location.bucket}/${params.location.key}.`,
          'RetentionActive',
        );
      }
      throw error;
    }
  }
}
