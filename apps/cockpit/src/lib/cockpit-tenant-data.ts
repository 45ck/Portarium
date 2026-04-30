import type { QueryClient } from '@tanstack/react-query';
import { clearApprovalDecisionOutbox } from '@/lib/approval-decision-outbox';
import { clearOfflineCacheEntries } from '@/lib/offline-cache';
import { clearPersistedQueryCache, queryClient } from '@/lib/query-client';
import { deleteOfflineDatabase } from '@/lib/offline-store';

const COCKPIT_PWA_CACHE_PREFIX = 'portarium-cockpit-pwa-';
const SESSION_TENANT_KEYS = [
  'portarium_pkce_state',
  'portarium_cockpit_bearer_token',
  'portarium_cockpit_refresh_token',
  'portarium_bearer_token',
] as const;

interface CacheStorageLike {
  keys(): Promise<string[]>;
  delete(key: string): Promise<boolean>;
}

interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface PurgeCockpitTenantDataOptions {
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  cacheStorage?: CacheStorageLike | null;
  queryClientInstance?: Pick<QueryClient, 'clear'>;
  deleteOfflineDatabase?: () => Promise<void>;
}

function getLocalStorage(): StorageLike | null {
  if (typeof window !== 'undefined') return window.localStorage;
  return globalThis.localStorage ?? null;
}

function getSessionStorage(): StorageLike | null {
  if (typeof window !== 'undefined') return window.sessionStorage;
  return globalThis.sessionStorage ?? null;
}

function getCacheStorage(): CacheStorageLike | null {
  if (typeof caches === 'undefined') return null;
  return caches;
}

export function clearCockpitSessionTenantData(storage: StorageLike | null = getSessionStorage()) {
  if (!storage) return 0;
  let removed = 0;
  for (const key of SESSION_TENANT_KEYS) {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removed += 1;
    }
  }
  return removed;
}

export async function clearCockpitCacheStorage(
  cacheStorage: CacheStorageLike | null = getCacheStorage(),
): Promise<number> {
  if (!cacheStorage) return 0;
  const keys = await cacheStorage.keys();
  const cockpitKeys = keys.filter((key) => key.startsWith(COCKPIT_PWA_CACHE_PREFIX));
  await Promise.all(cockpitKeys.map((key) => cacheStorage.delete(key)));
  return cockpitKeys.length;
}

export async function purgeCockpitTenantData(
  options: PurgeCockpitTenantDataOptions = {},
): Promise<void> {
  const local = options.localStorage === undefined ? getLocalStorage() : options.localStorage;
  const session =
    options.sessionStorage === undefined ? getSessionStorage() : options.sessionStorage;
  const cacheStorage =
    options.cacheStorage === undefined ? getCacheStorage() : options.cacheStorage;
  const deleteDb = options.deleteOfflineDatabase ?? deleteOfflineDatabase;
  const client = options.queryClientInstance ?? queryClient;

  clearPersistedQueryCache(local);
  clearOfflineCacheEntries(local ?? undefined);
  clearApprovalDecisionOutbox(local ?? undefined);
  clearCockpitSessionTenantData(session);
  client.clear();

  const results = await Promise.allSettled([deleteDb(), clearCockpitCacheStorage(cacheStorage)]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[cockpit-data] tenant purge step failed', result.reason);
    }
  }
}
