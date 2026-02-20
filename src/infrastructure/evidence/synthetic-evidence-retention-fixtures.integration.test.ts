import { describe, expect, it } from 'vitest';

import {
  appendEvidenceEntryV1,
  verifyEvidenceChainV1,
} from '../../domain/evidence/evidence-chain-v1.js';
import {
  createLegalHoldWorkflowFixtureV1,
  createProofOfRetentionFixtureV1,
} from '../../domain/testing/synthetic-evidence-retention-fixtures-v1.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';

describe('synthetic evidence retention fixtures', () => {
  it('supports proof-of-retention workflow fixtures through retention expiry and disposition', async () => {
    let now = Date.parse('2026-02-20T00:00:00.000Z');
    const store = new InMemoryWormEvidencePayloadStore({ clock: () => now });
    const hasher = new NodeCryptoEvidenceHasher();
    const fixture = createProofOfRetentionFixtureV1();

    await store.put({ location: fixture.payloadLocation, bytes: new Uint8Array([1, 2, 3]) });
    await store.applyWormControls({
      location: fixture.payloadLocation,
      retentionSchedule: fixture.retentionSchedule,
    });

    const captured = appendEvidenceEntryV1({
      previous: undefined,
      hasher,
      next: fixture.events.captured,
    });

    await expect(store.delete({ location: fixture.payloadLocation })).rejects.toMatchObject({
      name: 'EvidencePayloadDeletionBlockedError',
      reason: 'RetentionActive',
    });

    now = Date.parse('2026-03-02T00:00:00.000Z');
    await expect(store.delete({ location: fixture.payloadLocation })).resolves.toBeUndefined();

    const disposed = appendEvidenceEntryV1({
      previous: captured,
      hasher,
      next: fixture.events.disposed,
    });

    expect(verifyEvidenceChainV1([captured, disposed], hasher)).toEqual({ ok: true });
  });

  it('supports legal-hold workflow fixtures and blocks disposition until hold release', async () => {
    let now = Date.parse('2026-02-20T00:00:00.000Z');
    const store = new InMemoryWormEvidencePayloadStore({ clock: () => now });
    const hasher = new NodeCryptoEvidenceHasher();
    const fixture = createLegalHoldWorkflowFixtureV1();

    await store.put({
      location: fixture.payloadLocation,
      bytes: new Uint8Array([0x6c, 0x6f, 0x67]),
    });
    await store.applyWormControls({
      location: fixture.payloadLocation,
      retentionSchedule: fixture.retentionSchedule,
    });

    const captured = appendEvidenceEntryV1({
      previous: undefined,
      hasher,
      next: fixture.events.captured,
    });

    await store.applyWormControls({
      location: fixture.payloadLocation,
      retentionSchedule: fixture.legalHoldEnabledSchedule,
    });

    const legalHoldApplied = appendEvidenceEntryV1({
      previous: captured,
      hasher,
      next: fixture.events.legalHoldApplied,
    });

    now = Date.parse('2026-03-03T00:00:00.000Z');
    await expect(store.delete({ location: fixture.payloadLocation })).rejects.toMatchObject({
      name: 'EvidencePayloadDeletionBlockedError',
      reason: 'LegalHold',
    });

    await store.applyWormControls({
      location: fixture.payloadLocation,
      retentionSchedule: fixture.legalHoldReleasedSchedule,
    });

    const legalHoldReleased = appendEvidenceEntryV1({
      previous: legalHoldApplied,
      hasher,
      next: fixture.events.legalHoldReleased,
    });

    await expect(store.delete({ location: fixture.payloadLocation })).resolves.toBeUndefined();

    const disposed = appendEvidenceEntryV1({
      previous: legalHoldReleased,
      hasher,
      next: fixture.events.disposed,
    });

    expect(
      verifyEvidenceChainV1([captured, legalHoldApplied, legalHoldReleased, disposed], hasher),
    ).toEqual({
      ok: true,
    });
  });
});
