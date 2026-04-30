// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOfflineCacheEntries, readOfflineCache, writeOfflineCache } from '@/lib/offline-cache';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('offline cache', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('writes and reads cached payload envelopes', () => {
    writeOfflineCache(
      'approvals:ws-demo',
      { items: [{ approvalId: 'apr-1' }] },
      { savedAtIso: '2026-02-21T00:00:00.000Z' },
    );
    const cached = readOfflineCache<{ items: Array<{ approvalId: string }> }>('approvals:ws-demo');

    expect(cached).toEqual({
      version: 1,
      savedAtIso: '2026-02-21T00:00:00.000Z',
      data: { items: [{ approvalId: 'apr-1' }] },
    });
  });

  it('returns null for invalid JSON values', () => {
    localStorage.setItem('portarium:cockpit:offline:broken', '{oops');
    expect(readOfflineCache('broken')).toBeNull();
  });

  it('does not read or write offline tenant payloads in live mode by default', () => {
    const livePolicy = {
      runtimeMode: 'live' as const,
      usesLiveTenantData: true,
      allowOfflineTenantData: false,
      persistTenantQueryCache: false,
      serviceWorkerTenantApiCache: false,
    };

    writeOfflineCache(
      'runs:ws-1',
      { items: [{ runId: 'run-1' }] },
      { savedAtIso: '2026-02-21T00:00:00.000Z', policy: livePolicy },
    );

    expect(localStorage.getItem('portarium:cockpit:offline:runs:ws-1')).toBeNull();
    localStorage.setItem(
      'portarium:cockpit:offline:runs:ws-1',
      JSON.stringify({
        version: 1,
        savedAtIso: '2026-02-21T00:00:00.000Z',
        data: { items: [{ runId: 'run-1' }] },
      }),
    );
    expect(readOfflineCache('runs:ws-1', undefined, livePolicy)).toBeNull();
  });

  it('purges every offline cache entry and leaves unrelated preferences', () => {
    localStorage.setItem('portarium:cockpit:offline:runs:ws-1', '{}');
    localStorage.setItem('portarium:cockpit:offline:approvals:ws-1', '{}');
    localStorage.setItem('portarium-triage-view', 'briefing');

    expect(clearOfflineCacheEntries()).toBe(2);
    expect(localStorage.getItem('portarium:cockpit:offline:runs:ws-1')).toBeNull();
    expect(localStorage.getItem('portarium:cockpit:offline:approvals:ws-1')).toBeNull();
    expect(localStorage.getItem('portarium-triage-view')).toBe('briefing');
  });
});
