import {
  DeleteObjectCommand,
  PutObjectLegalHoldCommand,
  PutObjectRetentionCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import { EvidencePayloadDeletionBlockedError } from '../../application/ports/evidence-payload-store.js';
import { S3WormEvidencePayloadStore } from './s3-worm-evidence-payload-store.js';

describe('S3WormEvidencePayloadStore', () => {
  it('applies COMPLIANCE retention and legal hold through Object Lock APIs', async () => {
    const send = vi.fn().mockResolvedValue({});
    const s3 = { send } as unknown as S3Client;
    const store = new S3WormEvidencePayloadStore({ s3 });

    await store.applyWormControls({
      location: { bucket: 'evidence', key: 'runs/run-1/plan.json' },
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso: '2026-03-01T00:00:00.000Z',
        legalHold: true,
      },
    });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectRetentionCommand);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: 'evidence',
      Key: 'runs/run-1/plan.json',
      Retention: { Mode: 'COMPLIANCE' },
    });
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(PutObjectLegalHoldCommand);
    expect(send.mock.calls[1]?.[0].input).toMatchObject({
      Bucket: 'evidence',
      Key: 'runs/run-1/plan.json',
      LegalHold: { Status: 'ON' },
    });
  });

  it('maps S3 AccessDenied on delete to EvidencePayloadDeletionBlockedError', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    const s3 = { send } as unknown as S3Client;
    const store = new S3WormEvidencePayloadStore({ s3 });

    await expect(
      store.delete({ location: { bucket: 'evidence', key: 'runs/run-1/artifact.bin' } }),
    ).rejects.toBeInstanceOf(EvidencePayloadDeletionBlockedError);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
