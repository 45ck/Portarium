import { useEffect, useMemo, useState } from 'react';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { readOfflineCache, writeOfflineCache } from '@/lib/offline-cache';

type OfflineDataSource = 'network' | 'cache' | 'none';

export interface OfflineQueryMeta {
  isOffline: boolean;
  isStaleData: boolean;
  dataSource: OfflineDataSource;
  lastSyncAtIso?: string;
}

interface UseOfflineQueryOptions<TData, TQueryKey extends QueryKey> extends Omit<
  UseQueryOptions<TData, Error, TData, TQueryKey>,
  'queryFn' | 'queryKey'
> {
  queryKey: TQueryKey;
  cacheKey: string;
  queryFn: () => Promise<TData>;
}

export function useOfflineQuery<TData, TQueryKey extends QueryKey>(
  options: UseOfflineQueryOptions<TData, TQueryKey>,
) {
  const { cacheKey, queryFn, ...queryOptions } = options;

  const cached = useMemo(() => readOfflineCache<TData>(cacheKey), [cacheKey]);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [lastSyncAtIso, setLastSyncAtIso] = useState<string | undefined>(cached?.savedAtIso);
  const [dataSource, setDataSource] = useState<OfflineDataSource>(cached ? 'cache' : 'none');

  useEffect(() => {
    setLastSyncAtIso(cached?.savedAtIso);
    setDataSource(cached ? 'cache' : 'none');
  }, [cached?.savedAtIso]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const query = useQuery<TData, Error, TData, TQueryKey>({
    ...queryOptions,
    initialData: cached?.data,
    queryFn: async () => {
      try {
        const data = await queryFn();
        const entry = writeOfflineCache(cacheKey, data);
        setLastSyncAtIso(entry.savedAtIso);
        setDataSource('network');
        return data;
      } catch (error) {
        const fallback = readOfflineCache<TData>(cacheKey);
        if (fallback) {
          setLastSyncAtIso(fallback.savedAtIso);
          setDataSource('cache');
          return fallback.data;
        }
        throw error;
      }
    },
  });

  return {
    ...query,
    offlineMeta: {
      isOffline,
      isStaleData: dataSource !== 'network' && Boolean(query.data),
      dataSource,
      lastSyncAtIso,
    } satisfies OfflineQueryMeta,
  };
}
