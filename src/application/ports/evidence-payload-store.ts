import type { RetentionScheduleV1 } from '../../domain/evidence/retention-schedule-v1.js';

export type EvidencePayloadLocation = Readonly<{
  bucket: string;
  key: string;
}>;

export class EvidencePayloadAlreadyExistsError extends Error {
  public override readonly name = 'EvidencePayloadAlreadyExistsError';

  public constructor(message: string) {
    super(message);
  }
}

export class EvidencePayloadDeletionBlockedError extends Error {
  public override readonly name = 'EvidencePayloadDeletionBlockedError';

  public constructor(
    message: string,
    public readonly reason: 'LegalHold' | 'RetentionActive',
  ) {
    super(message);
  }
}

export interface EvidencePayloadStorePort {
  /**
   * Write-once: implementations must not overwrite an existing object at the
   * given location.
   */
  put(params: Readonly<{ location: EvidencePayloadLocation; bytes: Uint8Array }>): Promise<void>;

  /**
   * Apply WORM controls for the object. For object-stores that support it, this
   * should map to Object Lock retention and legal hold controls.
   */
  applyWormControls(
    params: Readonly<{
      location: EvidencePayloadLocation;
      retentionSchedule: RetentionScheduleV1;
    }>,
  ): Promise<void>;

  /**
   * Delete is only permitted when retention has expired and legal hold is not active.
   * Implementations must raise EvidencePayloadDeletionBlockedError when blocked.
   */
  delete(params: Readonly<{ location: EvidencePayloadLocation }>): Promise<void>;
}
