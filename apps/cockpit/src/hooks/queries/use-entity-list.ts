import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CursorPage } from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  refetch: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalLabel: string;
  pageIndex: number;
}

const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

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

  // Current cursor for the active page
  const cursor = pageIndex > 0 ? cursorStack.current[pageIndex - 1] : undefined;

  // Build the query key — must capture all params that affect the response
  const activeFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== 'all'),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filters)],
  );

  const queryKey = useMemo(
    () => [entityKey, workspaceId, activeFilters, search, sort, pageSize, cursor],
    [entityKey, workspaceId, activeFilters, search, sort, pageSize, cursor],
  );

  const queryFn = useCallback(async (): Promise<CursorPage<TItem>> => {
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    if (cursor) params.set('cursor', cursor);
    if (search) params.set('q', search);
    if (sort) params.set('sort', `${sort.field}:${sort.direction}`);

    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) params.set(key, value);
    }

    const url = `${basePath}?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${entityKey}`);
    return res.json() as Promise<CursorPage<TItem>>;
  }, [basePath, entityKey, pageSize, cursor, search, sort, activeFilters]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn,
    enabled: Boolean(workspaceId) && enabled,
  });

  // Reset to page 0 when filters/search/sort change
  const prevParamsRef = useRef<string>('');
  const paramsKey = JSON.stringify({ activeFilters, search, sort, pageSize });
  if (paramsKey !== prevParamsRef.current) {
    prevParamsRef.current = paramsKey;
    if (pageIndex !== 0) {
      setPageIndex(0);
      cursorStack.current = [];
    }
  }

  const hasNextPage = Boolean(data?.nextCursor);
  const hasPreviousPage = pageIndex > 0;

  const goToNextPage = useCallback(() => {
    if (!data?.nextCursor) return;
    cursorStack.current[pageIndex] = data.nextCursor;
    setPageIndex((p) => p + 1);
  }, [data?.nextCursor, pageIndex]);

  const goToPreviousPage = useCallback(() => {
    if (pageIndex <= 0) return;
    setPageIndex((p) => p - 1);
  }, [pageIndex]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageIndex(0);
    cursorStack.current = [];
  }, []);

  const items = data?.items;
  const count = items?.length ?? 0;
  const start = count > 0 ? pageIndex * pageSize + 1 : 0;
  const end = pageIndex * pageSize + count;
  const totalLabel = count > 0 ? `Showing ${start}\u2013${end}` : 'No results';

  return {
    data: items as TItem[] | undefined,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    pageSize,
    setPageSize,
    totalLabel,
    pageIndex,
  };
}
