import type { EvidencePayloadStorePort } from '../../application/ports/evidence-payload-store.js';
import {
  EvidencePayloadAlreadyExistsError,
  EvidencePayloadDeletionBlockedError,
  type EvidencePayloadLocation,
} from '../../application/ports/evidence-payload-store.js';
import type { RetentionScheduleV1 } from '../../domain/evidence/retention-schedule-v1.js';

interface StoredObject {
  bytes: Uint8Array;
  retainUntilMs?: number;
  legalHold?: boolean;
  lockMode?: 'GOVERNANCE' | 'COMPLIANCE';
}

function keyOf(location: EvidencePayloadLocation): string {
  return `${location.bucket}/${location.key}`;
}

function parseRetainUntilMs(schedule: RetentionScheduleV1): number | undefined {
  if (schedule.retainUntilIso === undefined) return undefined;
  const ms = Date.parse(schedule.retainUntilIso);
  return Number.isFinite(ms) ? ms : undefined;
}

function lockModeFor(schedule: RetentionScheduleV1): 'GOVERNANCE' | 'COMPLIANCE' {
  // The domain's RetentionClass is higher-level than storage. We treat Compliance/Forensic
  // as COMPLIANCE mode; Operational maps to GOVERNANCE mode by default.
  return schedule.retentionClass === 'Operational' ? 'GOVERNANCE' : 'COMPLIANCE';
}

function assertRetentionExtensionOnly(
  obj: StoredObject,
  nextRetainUntilMs: number | undefined,
): void {
  const currentRetainUntil = obj.retainUntilMs;
  if (
    obj.lockMode === 'COMPLIANCE' &&
    currentRetainUntil !== undefined &&
    nextRetainUntilMs !== undefined &&
    nextRetainUntilMs < currentRetainUntil
  ) {
    throw new Error('Cannot shorten retention while in COMPLIANCE mode.');
  }
}

export class InMemoryWormEvidencePayloadStore implements EvidencePayloadStorePort {
  readonly #clock: () => number;
  readonly #objects = new Map<string, StoredObject>();

  public constructor(params?: Readonly<{ clock?: () => number }>) {
    this.#clock = params?.clock ?? (() => Date.now());
  }

  public put(
    params: Readonly<{ location: EvidencePayloadLocation; bytes: Uint8Array }>,
  ): Promise<void> {
    const key = keyOf(params.location);
    if (this.#objects.has(key)) {
      return Promise.reject(
        new EvidencePayloadAlreadyExistsError(`Evidence payload already exists at ${key}.`),
      );
    }
    // Copy bytes to keep store immutable against caller mutations.
    this.#objects.set(key, { bytes: new Uint8Array(params.bytes) });
    return Promise.resolve();
  }

  public applyWormControls(
    params: Readonly<{
      location: EvidencePayloadLocation;
      retentionSchedule: RetentionScheduleV1;
    }>,
  ): Promise<void> {
    const key = keyOf(params.location);
    const obj = this.#objects.get(key);
    if (obj === undefined) {
      // Keep this store minimal; callers should only apply controls after put.
      return Promise.reject(new Error(`Cannot apply WORM controls to missing object: ${key}.`));
    }

    const nextMode = lockModeFor(params.retentionSchedule);
    const nextRetainUntilMs = parseRetainUntilMs(params.retentionSchedule);
    const nextLegalHold = params.retentionSchedule.legalHold === true;

    // Approximate S3 semantics: legal hold can be turned on; in compliance-mode,
    // retention can only be extended, not shortened.
    assertRetentionExtensionOnly(obj, nextRetainUntilMs);

    obj.lockMode = obj.lockMode ?? nextMode;
    if (nextRetainUntilMs !== undefined) {
      obj.retainUntilMs = Math.max(obj.retainUntilMs ?? 0, nextRetainUntilMs);
    }
    if (nextLegalHold) {
      obj.legalHold = true;
    } else if (params.retentionSchedule.legalHold !== undefined) {
      obj.legalHold = false;
    }
    return Promise.resolve();
  }

  public delete(params: Readonly<{ location: EvidencePayloadLocation }>): Promise<void> {
    const key = keyOf(params.location);
    const obj = this.#objects.get(key);
    if (obj === undefined) return Promise.resolve();

    if (obj.legalHold === true) {
      return Promise.reject(
        new EvidencePayloadDeletionBlockedError(
          `Deletion blocked by legal hold for ${key}.`,
          'LegalHold',
        ),
      );
    }

    const now = this.#clock();
    if (obj.retainUntilMs !== undefined && now < obj.retainUntilMs) {
      return Promise.reject(
        new EvidencePayloadDeletionBlockedError(
          `Deletion blocked by active retention for ${key}.`,
          'RetentionActive',
        ),
      );
    }

    this.#objects.delete(key);
    return Promise.resolve();
  }

  public __test__get(location: EvidencePayloadLocation): StoredObject | undefined {
    return this.#objects.get(keyOf(location));
  }
}
