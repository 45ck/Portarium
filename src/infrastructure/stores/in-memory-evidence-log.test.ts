import { describe, expect, it } from 'vitest';

import {
  CorrelationId,
  EvidenceId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import type { EvidenceEntryAppendInput } from '../../application/ports/evidence-log.js';
import { InMemoryEvidenceLog } from './in-memory-evidence-log.js';

const T = TenantId('t-1');

function makeEntry(id: string, category: string): EvidenceEntryAppendInput {
  return {
    schemaVersion: 1,
    evidenceId: EvidenceId(id),
    workspaceId: WorkspaceId('ws-1'),
    correlationId: CorrelationId('corr-1'),
    category,
    occurredAtIso: '2026-01-01T00:00:00Z',
    actor: { kind: 'System' },
  };
}

describe('InMemoryEvidenceLog', () => {
  it('appends an entry and returns it with a hash', async () => {
    const log = new InMemoryEvidenceLog();
    const result = await log.appendEntry(T, makeEntry('ev-1', 'Plan'));
    expect(result.hashSha256).toBeTruthy();
    expect(String(result.hashSha256).startsWith('sha256:')).toBe(true);
    expect(result.previousHash).toBeUndefined();
  });

  it('hash-chains consecutive entries', async () => {
    const log = new InMemoryEvidenceLog();
    const first = await log.appendEntry(T, makeEntry('ev-1', 'Plan'));
    const second = await log.appendEntry(T, makeEntry('ev-2', 'Approval'));
    expect(second.previousHash).toBe(first.hashSha256);
    expect(second.hashSha256).not.toBe(first.hashSha256);
  });

  it('isolates chains by tenant', async () => {
    const log = new InMemoryEvidenceLog();
    await log.appendEntry(TenantId('t-a'), makeEntry('ev-a', 'Plan'));
    const b = await log.appendEntry(TenantId('t-b'), makeEntry('ev-b', 'Plan'));
    expect(b.previousHash).toBeUndefined(); // separate chain
  });

  it('listEntries returns copies', async () => {
    const log = new InMemoryEvidenceLog();
    await log.appendEntry(T, makeEntry('ev-1', 'Plan'));
    await log.appendEntry(T, makeEntry('ev-2', 'Action'));
    const entries = log.listEntries(T);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.category).toBe('Plan');
    expect(entries[1]!.category).toBe('Action');
  });
});
