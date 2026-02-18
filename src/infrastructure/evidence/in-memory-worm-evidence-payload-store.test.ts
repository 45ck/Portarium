import { describe, expect, it } from 'vitest';

import {
  EvidencePayloadAlreadyExistsError,
  EvidencePayloadDeletionBlockedError,
} from '../../application/ports/evidence-payload-store.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';

describe('InMemoryWormEvidencePayloadStore', () => {
  it('enforces write-once immutability', async () => {
    const store = new InMemoryWormEvidencePayloadStore();
    const location = { bucket: 'evidence', key: 'runs/run-1/plan.json' } as const;

    await store.put({ location, bytes: new Uint8Array([1, 2, 3]) });
    await expect(store.put({ location, bytes: new Uint8Array([9]) })).rejects.toBeInstanceOf(
      EvidencePayloadAlreadyExistsError,
    );
  });

  it('blocks deletion while compliance retention is active', async () => {
    let now = Date.parse('2026-02-18T00:00:00.000Z');
    const store = new InMemoryWormEvidencePayloadStore({ clock: () => now });
    const location = { bucket: 'evidence', key: 'runs/run-1/artifact.bin' } as const;

    await store.put({ location, bytes: new Uint8Array([7]) });
    await store.applyWormControls({
      location,
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso: '2026-02-19T00:00:00.000Z',
      },
    });

    await expect(
      store.delete({ location }),
    ).rejects.toMatchObject<EvidencePayloadDeletionBlockedError>({
      name: 'EvidencePayloadDeletionBlockedError',
      reason: 'RetentionActive',
    });

    now = Date.parse('2026-02-20T00:00:00.000Z');
    await expect(store.delete({ location })).resolves.toBeUndefined();
  });

  it('blocks deletion when legal hold is active (even after retention)', async () => {
    let now = Date.parse('2026-02-18T00:00:00.000Z');
    const store = new InMemoryWormEvidencePayloadStore({ clock: () => now });
    const location = { bucket: 'evidence', key: 'runs/run-1/log.txt' } as const;

    await store.put({ location, bytes: new Uint8Array([0x6c, 0x6f, 0x67]) });
    await store.applyWormControls({
      location,
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso: '2026-02-19T00:00:00.000Z',
        legalHold: true,
      },
    });

    now = Date.parse('2026-02-20T00:00:00.000Z');
    await expect(
      store.delete({ location }),
    ).rejects.toMatchObject<EvidencePayloadDeletionBlockedError>({
      name: 'EvidencePayloadDeletionBlockedError',
      reason: 'LegalHold',
    });
  });
});
