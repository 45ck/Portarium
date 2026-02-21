export interface StoredCacheEntry<T> {
  version: 1;
  savedAtIso: string;
  data: T;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const OFFLINE_CACHE_PREFIX = 'portarium:cockpit:offline:';

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
): StoredCacheEntry<T> | null {
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
  options?: { storage?: StorageLike; savedAtIso?: string },
): StoredCacheEntry<T> {
  const target = getStorage(options?.storage);
  const entry: StoredCacheEntry<T> = {
    version: 1,
    savedAtIso: options?.savedAtIso ?? new Date().toISOString(),
    data,
  };
  if (target) {
    target.setItem(fullKey(cacheKey), JSON.stringify(entry));
  }
  return entry;
}
