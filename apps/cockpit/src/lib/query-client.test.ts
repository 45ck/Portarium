import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  QUERY_CACHE_STORAGE_KEY,
  clearPersistedQueryCache,
  hydrateQueryCacheFromStorage,
  startQueryCachePersistence,
} from './query-client';

const demoPolicy = {
  runtimeMode: 'demo' as const,
  usesLiveTenantData: false,
  allowOfflineTenantData: true,
  persistTenantQueryCache: true,
  serviceWorkerTenantApiCache: true,
};

const livePolicy = {
  runtimeMode: 'live' as const,
  usesLiveTenantData: true,
  allowOfflineTenantData: false,
  persistTenantQueryCache: false,
  serviceWorkerTenantApiCache: false,
};

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

describe('query cache persistence', () => {
  it('does not persist workspace extension-context grants', () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      const storage = createMemoryStorage();
      const stop = startQueryCachePersistence(client, storage, demoPolicy);

      client.setQueryData(['cockpit-extension-context', 'ws-1', 'user-1'], {
        activePackIds: ['demo.pack'],
      });
      client.setQueryData(['runs', 'ws-1'], { items: [] });
      client.setQueryData(['evidence', 'ws-1'], { items: [{ evidenceId: 'ev-1' }] });
      client.setQueryData(['users', 'ws-1'], { items: [{ userId: 'user-1' }] });
      vi.runAllTimers();

      const persisted = JSON.parse(storage.getItem(QUERY_CACHE_STORAGE_KEY) ?? '{}') as {
        cache?: { queries?: { queryKey: unknown[] }[] };
      };
      expect(persisted.cache?.queries?.map((query) => query.queryKey)).toEqual([['runs', 'ws-1']]);

      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the persisted query cache entry', () => {
    const storage = createMemoryStorage();
    storage.setItem(QUERY_CACHE_STORAGE_KEY, '{}');
    clearPersistedQueryCache(storage);
    expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
  });

  it('does not persist or hydrate tenant query cache in live mode by default', () => {
    vi.useFakeTimers();
    try {
      const client = new QueryClient();
      const storage = createMemoryStorage();
      storage.setItem(
        QUERY_CACHE_STORAGE_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          cache: { mutations: [], queries: [] },
        }),
      );

      hydrateQueryCacheFromStorage(client, storage, livePolicy);
      expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();

      const stop = startQueryCachePersistence(client, storage, livePolicy);
      client.setQueryData(['approvals', 'ws-1'], { items: [{ approvalId: 'ap-1' }] });
      vi.runAllTimers();

      expect(storage.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
      stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
