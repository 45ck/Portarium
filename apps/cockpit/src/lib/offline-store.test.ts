// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  putPendingDecision,
  getPendingDecisions,
  getAllPendingDecisions,
  removePendingDecision,
  countPendingDecisions,
  putCachedResponse,
  getCachedResponse,
  clearCachedResponses,
  deleteOfflineDatabase,
  type PendingDecision,
  type CachedResponse,
} from '@/lib/offline-store';

// Skip the entire suite when IndexedDB is not available (e.g. basic jsdom without fake-indexeddb).
const hasIndexedDB = typeof indexedDB !== 'undefined';

describe.skipIf(!hasIndexedDB)('offline-store (IndexedDB)', () => {
  beforeEach(async () => {
    await deleteOfflineDatabase();
  });

  describe('pending decisions', () => {
    const decision: PendingDecision = {
      idempotencyKey: 'ws-1:ap-1:Approved:safe',
      workspaceId: 'ws-1',
      approvalId: 'ap-1',
      decision: 'Approved',
      rationale: 'safe',
      queuedAt: '2026-03-30T00:00:00.000Z',
      attemptCount: 0,
      nextAttemptAt: '2026-03-30T00:00:00.000Z',
    };

    it('stores and retrieves pending decisions by workspace', async () => {
      await putPendingDecision(decision);
      const results = await getPendingDecisions('ws-1');
      expect(results).toHaveLength(1);
      expect(results[0]?.approvalId).toBe('ap-1');
    });

    it('deduplicates by idempotency key (put overwrites)', async () => {
      await putPendingDecision(decision);
      await putPendingDecision({ ...decision, attemptCount: 1 });
      const results = await getPendingDecisions('ws-1');
      expect(results).toHaveLength(1);
      expect(results[0]?.attemptCount).toBe(1);
    });

    it('removes a decision by idempotency key', async () => {
      await putPendingDecision(decision);
      await removePendingDecision(decision.idempotencyKey);
      const results = await getPendingDecisions('ws-1');
      expect(results).toHaveLength(0);
    });

    it('counts all pending decisions across workspaces', async () => {
      await putPendingDecision(decision);
      await putPendingDecision({
        ...decision,
        idempotencyKey: 'ws-2:ap-2:Denied:no',
        workspaceId: 'ws-2',
        approvalId: 'ap-2',
      });
      const count = await countPendingDecisions();
      expect(count).toBe(2);
    });

    it('retrieves all pending decisions', async () => {
      await putPendingDecision(decision);
      await putPendingDecision({
        ...decision,
        idempotencyKey: 'ws-2:ap-2:Denied:no',
        workspaceId: 'ws-2',
        approvalId: 'ap-2',
      });
      const all = await getAllPendingDecisions();
      expect(all).toHaveLength(2);
    });

    it('returns empty list for unknown workspace', async () => {
      const results = await getPendingDecisions('ws-unknown');
      expect(results).toHaveLength(0);
    });
  });

  describe('cached responses', () => {
    const cached: CachedResponse = {
      cacheKey: 'approvals:ws-1',
      data: { items: [{ approvalId: 'ap-1' }] },
      savedAt: '2026-03-30T00:00:00.000Z',
    };

    it('stores and retrieves cached API responses', async () => {
      await putCachedResponse(cached);
      const result = await getCachedResponse('approvals:ws-1');
      expect(result).toEqual(cached);
    });

    it('returns undefined for missing cache key', async () => {
      const result = await getCachedResponse('nonexistent');
      expect(result).toBeUndefined();
    });

    it('overwrites existing cache entry', async () => {
      await putCachedResponse(cached);
      await putCachedResponse({ ...cached, savedAt: '2026-03-31T00:00:00.000Z' });
      const result = await getCachedResponse('approvals:ws-1');
      expect(result?.savedAt).toBe('2026-03-31T00:00:00.000Z');
    });

    it('clears all cached responses', async () => {
      await putCachedResponse(cached);
      await clearCachedResponses();
      const result = await getCachedResponse('approvals:ws-1');
      expect(result).toBeUndefined();
    });
  });
});

describe('offline-store graceful degradation', () => {
  it('rejects with meaningful error when IndexedDB is unavailable', async () => {
    // Temporarily remove indexedDB
    const original = globalThis.indexedDB;
    // @ts-ignore — intentional deletion for test
    delete globalThis.indexedDB;

    try {
      await expect(
        putPendingDecision({
          idempotencyKey: 'test',
          workspaceId: 'ws-1',
          approvalId: 'ap-1',
          decision: 'Approved',
          rationale: 'test',
          queuedAt: new Date().toISOString(),
          attemptCount: 0,
          nextAttemptAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('IndexedDB not available');
    } finally {
      // @ts-ignore — restoring
      globalThis.indexedDB = original;
    }
  });
});
