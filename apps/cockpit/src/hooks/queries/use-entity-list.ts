import { useCallback, useMemo, useRef, useState } from 'react';
import type { CursorPage } from '@portarium/cockpit-types';
import { useOfflineQuery, type OfflineQueryMeta } from '@/hooks/queries/use-offline-query';

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseEntityListOptions<TFilter extends Record<string, string | undefined>> {
  entityKey: string;
  workspaceId: string;
  basePath: string;
  filters: TFilter;
  search?: string;
  sort?: SortState;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseEntityListReturn<TItem> {
  data: TItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  dataUpdatedAt: number;
  refetch: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalLabel: string;
  pageIndex: number;
  offlineMeta: OfflineQueryMeta;
}

const DEFAULT_PAGE_SIZE = 20;

export function useEntityList<TItem, TFilter extends Record<string, string | undefined>>(
  options: UseEntityListOptions<TFilter>,
): UseEntityListReturn<TItem> {
  const {
    entityKey,
    workspaceId,
    basePath,
    filters,
    search,
    sort,
    pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
    enabled = true,
  } = options;

  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [pageIndex, setPageIndex] = useState(0);
  const cursorStack = useRef<string[]>([]);
  const cursor = pageIndex > 0 ? cursorStack.current[pageIndex - 1] : undefined;

  const activeFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filters)],
  );

  const params = useMemo(() => {
    const next = new URLSearchParams();
    next.set('limit', String(pageSize));
    if (cursor) next.set('cursor', cursor);
    if (search) next.set('q', search);
    if (sort) next.set('sort', `${sort.field}:${sort.direction}`);
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) next.set(key, value);
    }
    return next;
  }, [activeFilters, cursor, pageSize, search, sort]);

  const queryKey = useMemo(
    () => [entityKey, workspaceId, activeFilters, search, sort, pageSize, cursor],
    [entityKey, workspaceId, activeFilters, search, sort, pageSize, cursor],
  );

  const queryFn = useCallback(async (): Promise<CursorPage<TItem>> => {
    const res = await fetch(`${basePath}?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${entityKey}`);
    return (await res.json()) as CursorPage<TItem>;
  }, [basePath, entityKey, params]);

  const prevParamsRef = useRef<string>('');
  const paramsKey = JSON.stringify({ activeFilters, search, sort, pageSize });
  if (paramsKey !== prevParamsRef.current) {
    prevParamsRef.current = paramsKey;
    if (pageIndex !== 0) {
      setPageIndex(0);
      cursorStack.current = [];
    }
  }

  const query = useOfflineQuery({
    queryKey,
    cacheKey: `entity-list:${workspaceId}:${entityKey}:${params.toString()}`,
    queryFn,
    enabled: Boolean(workspaceId) && enabled,
  });

  const hasNextPage = Boolean(query.data?.nextCursor);
  const hasPreviousPage = pageIndex > 0;

  const goToNextPage = useCallback(() => {
    if (!query.data?.nextCursor) return;
    cursorStack.current[pageIndex] = query.data.nextCursor;
    setPageIndex((p) => p + 1);
  }, [query.data?.nextCursor, pageIndex]);

  const goToPreviousPage = useCallback(() => {
    if (pageIndex <= 0) return;
    setPageIndex((p) => p - 1);
  }, [pageIndex]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageIndex(0);
    cursorStack.current = [];
  }, []);

  const items = query.data?.items;
  const count = items?.length ?? 0;
  const start = count > 0 ? pageIndex * pageSize + 1 : 0;
  const end = pageIndex * pageSize + count;
  const totalLabel = count > 0 ? `Showing ${start}-${end}` : 'No results';

  return {
    data: items as TItem[] | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: () => {
      void query.refetch();
    },
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    pageSize,
    setPageSize,
    totalLabel,
    pageIndex,
    offlineMeta: query.offlineMeta,
  };
}
