// @vitest-environment jsdom

import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QUERY_CACHE_STORAGE_KEY } from '@/lib/query-client';
import { purgeCockpitTenantData } from '@/lib/cockpit-tenant-data';

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

function createCacheStorage(keys: string[]) {
  const cacheKeys = new Set(keys);
  return {
    async keys() {
      return [...cacheKeys];
    },
    delete: vi.fn(async (key: string) => cacheKeys.delete(key)),
    has(key: string) {
      return cacheKeys.has(key);
    },
  };
}

describe('cockpit tenant data purge', () => {
  let local: Storage;
  let session: Storage;

  beforeEach(() => {
    local = createMemoryStorage();
    session = createMemoryStorage();
  });

  it('purges tenant payload stores and keeps unrelated UI preferences', async () => {
    const queryClient = new QueryClient();
    const cacheStorage = createCacheStorage([
      'portarium-cockpit-pwa-v2-api',
      'portarium-cockpit-pwa-v2-shell',
      'third-party-cache',
    ]);
    const deleteOfflineDatabase = vi.fn(async () => {});

    local.setItem(QUERY_CACHE_STORAGE_KEY, '{"cached":true}');
    local.setItem('portarium:cockpit:offline:runs:ws-1', '{"items":[{"runId":"run-1"}]}');
    local.setItem('portarium:cockpit:approval-outbox:v1:ws-1', '[{"approvalId":"ap-1"}]');
    local.setItem('portarium-triage-view', 'briefing');
    session.setItem('portarium_pkce_state', '{"codeVerifier":"secret"}');
    queryClient.setQueryData(['runs', 'ws-1'], { items: [{ runId: 'run-1' }] });

    await purgeCockpitTenantData({
      localStorage: local,
      sessionStorage: session,
      cacheStorage,
      queryClientInstance: queryClient,
      deleteOfflineDatabase,
    });

    expect(local.getItem(QUERY_CACHE_STORAGE_KEY)).toBeNull();
    expect(local.getItem('portarium:cockpit:offline:runs:ws-1')).toBeNull();
    expect(local.getItem('portarium:cockpit:approval-outbox:v1:ws-1')).toBeNull();
    expect(local.getItem('portarium-triage-view')).toBe('briefing');
    expect(session.getItem('portarium_pkce_state')).toBeNull();
    expect(queryClient.getQueryData(['runs', 'ws-1'])).toBeUndefined();
    expect(deleteOfflineDatabase).toHaveBeenCalledTimes(1);
    expect(cacheStorage.has('portarium-cockpit-pwa-v2-api')).toBe(false);
    expect(cacheStorage.has('portarium-cockpit-pwa-v2-shell')).toBe(false);
    expect(cacheStorage.has('third-party-cache')).toBe(true);
  });
});
