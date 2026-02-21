import { useCallback, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { SortState } from './queries/use-entity-list';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListSearchParamsConfig {
  filterKeys: string[];
  route: { useSearch: () => Record<string, unknown> };
}

export interface ListSearchParamsReturn {
  filters: Record<string, string | undefined>;
  search: string | undefined;
  sort: SortState | undefined;
  setFilter: (key: string, value: string | undefined) => void;
  setSearch: (value: string | undefined) => void;
  setSort: (sort: SortState | undefined) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useListSearchParams(config: ListSearchParamsConfig): ListSearchParamsReturn {
  const { filterKeys, route } = config;
  const rawSearch = route.useSearch() as Record<string, string | undefined>;
  const navigate = useNavigate();

  const filters = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const key of filterKeys) {
      result[key] = rawSearch[key];
    }
    return result;
  }, [filterKeys, rawSearch]);

  const search = rawSearch.q ?? undefined;

  const sort: SortState | undefined = useMemo(() => {
    const raw = rawSearch.sort;
    if (!raw) return undefined;
    const [field, dir] = raw.split(':');
    if (!field) return undefined;
    return { field, direction: (dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
  }, [rawSearch.sort]);

  const updateSearch = useCallback(
    (updates: Record<string, string | undefined>) => {
      navigate({
        to: '.' as string,
        search: { ...rawSearch, ...updates } as Record<string, unknown>,
        replace: true,
      });
    },
    [navigate, rawSearch],
  );

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      updateSearch({ [key]: value === 'all' ? undefined : value });
    },
    [updateSearch],
  );

  const setSearch = useCallback(
    (value: string | undefined) => {
      updateSearch({ q: value || undefined });
    },
    [updateSearch],
  );

  const setSort = useCallback(
    (newSort: SortState | undefined) => {
      updateSearch({
        sort: newSort ? `${newSort.field}:${newSort.direction}` : undefined,
      });
    },
    [updateSearch],
  );

  const clearAll = useCallback(() => {
    const cleared: Record<string, undefined> = {};
    for (const key of filterKeys) {
      cleared[key] = undefined;
    }
    cleared.q = undefined;
    cleared.sort = undefined;
    updateSearch(cleared);
  }, [filterKeys, updateSearch]);

  const hasActiveFilters = useMemo(
    () =>
      Object.values(filters).some((v) => v !== undefined && v !== '' && v !== 'all') ||
      Boolean(search) ||
      Boolean(sort),
    [filters, search, sort],
  );

  return {
    filters,
    search,
    sort,
    setFilter,
    setSearch,
    setSort,
    clearAll,
    hasActiveFilters,
  };
}
