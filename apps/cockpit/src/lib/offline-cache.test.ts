// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readOfflineCache, writeOfflineCache } from '@/lib/offline-cache';

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
});
