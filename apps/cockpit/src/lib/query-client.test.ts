import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  QUERY_CACHE_STORAGE_KEY,
  clearPersistedQueryCache,
  startQueryCachePersistence,
} from './query-client';

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
      const stop = startQueryCachePersistence(client, storage);

      client.setQueryData(['cockpit-extension-context', 'ws-1', 'user-1'], {
        activePackIds: ['demo.pack'],
      });
      client.setQueryData(['runs', 'ws-1'], { items: [] });
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
});
