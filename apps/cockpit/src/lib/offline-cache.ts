import {
  shouldAllowOfflineTenantData,
  type CockpitDataRetentionPolicy,
} from '@/lib/cockpit-data-retention';

export interface StoredCacheEntry<T> {
  version: 1;
  savedAtIso: string;
  data: T;
}

interface StorageLike {
  readonly length?: number;
  getItem(key: string): string | null;
  key?(index: number): string | null;
  removeItem?(key: string): void;
  setItem(key: string, value: string): void;
}

export const OFFLINE_CACHE_PREFIX = 'portarium:cockpit:offline:';

function getStorage(storage?: StorageLike): StorageLike | undefined {
  if (storage) return storage;
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
}

function fullKey(cacheKey: string): string {
  return `${OFFLINE_CACHE_PREFIX}${cacheKey}`;
}

export function readOfflineCache<T>(
  cacheKey: string,
  storage?: StorageLike,
  policy?: CockpitDataRetentionPolicy,
): StoredCacheEntry<T> | null {
  if (!shouldAllowOfflineTenantData(policy)) return null;
  const target = getStorage(storage);
  if (!target) return null;
  const raw = target.getItem(fullKey(cacheKey));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredCacheEntry<T>;
    if (parsed.version !== 1 || !parsed.savedAtIso) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOfflineCache<T>(
  cacheKey: string,
  data: T,
  options?: { storage?: StorageLike; savedAtIso?: string; policy?: CockpitDataRetentionPolicy },
): StoredCacheEntry<T> {
  const target = getStorage(options?.storage);
  const entry: StoredCacheEntry<T> = {
    version: 1,
    savedAtIso: options?.savedAtIso ?? new Date().toISOString(),
    data,
  };
  if (target && shouldAllowOfflineTenantData(options?.policy)) {
    target.setItem(fullKey(cacheKey), JSON.stringify(entry));
  }
  return entry;
}

export function clearOfflineCacheEntries(storage?: StorageLike): number {
  const target = getStorage(storage);
  if (!target?.key || !target.removeItem || typeof target.length !== 'number') return 0;

  const keys: string[] = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (key?.startsWith(OFFLINE_CACHE_PREFIX)) keys.push(key);
  }

  for (const key of keys) {
    target.removeItem(key);
  }

  return keys.length;
}
