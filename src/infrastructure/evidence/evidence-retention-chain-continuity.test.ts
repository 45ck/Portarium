import { describe, expect, it } from 'vitest';

import { appendEvidenceEntryV1, verifyEvidenceChainV1 } from '../../domain/evidence/evidence-chain-v1.js';
import { CorrelationId, EvidenceId, HashSha256, RunId, WorkspaceId } from '../../domain/primitives/index.js';
import { NodeCryptoEvidenceHasher } from '../crypto/node-crypto-evidence-hasher.js';
import { InMemoryWormEvidencePayloadStore } from './in-memory-worm-evidence-payload-store.js';

describe('Evidence chain continuity under retention/disposition events', () => {
  it('keeps chain valid when payload is disposed and disposition metadata is appended', async () => {
    let now = Date.parse('2026-02-18T00:00:00.000Z');
    const store = new InMemoryWormEvidencePayloadStore({ clock: () => now });
    const hasher = new NodeCryptoEvidenceHasher();

    const location = { bucket: 'evidence', key: 'runs/run-1/raw-snapshot.json' } as const;
    await store.put({ location, bytes: new Uint8Array([1, 2, 3]) });
    await store.applyWormControls({
      location,
      retentionSchedule: {
        retentionClass: 'Compliance',
        retainUntilIso: '2026-02-19T00:00:00.000Z',
      },
    });

    const runId = RunId('run-1');
    const e1 = appendEvidenceEntryV1({
      previous: undefined,
      hasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-1'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-18T00:00:00.000Z',
        category: 'Action',
        summary: 'Raw provider snapshot captured.',
        actor: { kind: 'System' },
        links: { runId },
        payloadRefs: [{ kind: 'Snapshot', uri: 'evidence://runs/run-1/raw-snapshot.json' }],
      },
    });

    await expect(store.delete({ location })).rejects.toMatchObject({
      name: 'EvidencePayloadDeletionBlockedError',
      reason: 'RetentionActive',
    });

    now = Date.parse('2026-02-20T00:00:00.000Z');
    await expect(store.delete({ location })).resolves.toBeUndefined();

    const e2 = appendEvidenceEntryV1({
      previous: e1,
      hasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-2'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-20T00:00:00.000Z',
        category: 'Policy',
        summary: 'Retention disposition executed for payload reference.',
        actor: { kind: 'System' },
        links: { runId },
      },
    });

    expect(verifyEvidenceChainV1([e1, e2], hasher)).toEqual({ ok: true });
  });

  it('detects chain break if disposition metadata is linked to the wrong previous hash', () => {
    const hasher = new NodeCryptoEvidenceHasher();
    const runId = RunId('run-1');

    const e1 = appendEvidenceEntryV1({
      previous: undefined,
      hasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-1'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-18T00:00:00.000Z',
        category: 'System',
        summary: 'Chain genesis.',
        actor: { kind: 'System' },
        links: { runId },
      },
    });

    const e2 = appendEvidenceEntryV1({
      previous: e1,
      hasher,
      next: {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-2'),
        workspaceId: WorkspaceId('ws-1'),
        correlationId: CorrelationId('corr-1'),
        occurredAtIso: '2026-02-18T00:01:00.000Z',
        category: 'Policy',
        summary: 'Disposition metadata appended.',
        actor: { kind: 'System' },
        links: { runId },
      },
    });

    const broken = { ...e2, previousHash: HashSha256('deadbeef'.repeat(8)) };
    const verification = verifyEvidenceChainV1([e1, broken], hasher);
    expect(verification.ok).toBe(false);
    if (!verification.ok) {
      expect(verification.reason).toBe('previous_hash_mismatch');
      expect(verification.index).toBe(1);
    }
  });
});
