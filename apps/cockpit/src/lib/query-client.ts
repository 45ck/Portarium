import {
  QueryClient,
  dehydrate,
  hydrate,
  type DefaultError,
  type DehydratedState,
} from '@tanstack/react-query';
import { CockpitApiError } from '@/lib/control-plane-client';

const QUERY_CACHE_STORAGE_KEY = 'portarium-cockpit-query-cache-v1';
const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h
const QUERY_CACHE_WRITE_DEBOUNCE_MS = 300;

interface PersistedQueryCache {
  savedAt: number;
  cache: DehydratedState;
}

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function shouldRetryQuery(failureCount: number, error: DefaultError): boolean {
  if (!isBrowserOnline()) return false;

  if (error instanceof CockpitApiError) {
    const retryableHttp = error.status === 408 || error.status === 429 || error.status >= 500;
    if (!retryableHttp) return false;
  }

  return failureCount < 3;
}

function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 15_000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnReconnect: true,
      retry: shouldRetryQuery,
      retryDelay,
    },
  },
});

function parsePersistedCache(value: string | null): PersistedQueryCache | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PersistedQueryCache;
    if (typeof parsed?.savedAt !== 'number' || typeof parsed?.cache !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hydrateQueryCacheFromStorage(
  client: QueryClient = queryClient,
  storage: Storage | null = getStorage(),
): void {
  if (!storage) return;

  const persisted = parsePersistedCache(storage.getItem(QUERY_CACHE_STORAGE_KEY));
  if (!persisted) return;

  const age = Date.now() - persisted.savedAt;
  if (age > QUERY_CACHE_MAX_AGE_MS) {
    storage.removeItem(QUERY_CACHE_STORAGE_KEY);
    return;
  }

  hydrate(client, persisted.cache);
}

export function startQueryCachePersistence(
  client: QueryClient = queryClient,
  storage: Storage | null = getStorage(),
): () => void {
  if (!storage) return () => {};

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const persist = () => {
    const payload: PersistedQueryCache = {
      savedAt: Date.now(),
      cache: dehydrate(client),
    };
    storage.setItem(QUERY_CACHE_STORAGE_KEY, JSON.stringify(payload));
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(persist, QUERY_CACHE_WRITE_DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (timeout) clearTimeout(timeout);
  };
}

export function clearPersistedQueryCache(storage: Storage | null = getStorage()): void {
  storage?.removeItem(QUERY_CACHE_STORAGE_KEY);
}

export { QUERY_CACHE_STORAGE_KEY };
