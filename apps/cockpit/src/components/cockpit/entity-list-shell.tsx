import React, { useCallback, useState } from 'react';
import { PageHeader } from '@/components/cockpit/page-header';
import { FilterToolbar, type FilterFieldConfig } from '@/components/cockpit/filter-toolbar';
import {
  DataTable,
  type Column,
  type ServerPaginationConfig,
} from '@/components/cockpit/data-table';
import { EmptyState } from '@/components/cockpit/empty-state';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface EntityListShellProps<T> {
  // Page chrome
  title: string;
  icon?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;

  // Data
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;

  // Columns
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;

  // Filters
  filterConfig?: FilterFieldConfig[];
  filterValues?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;

  // Search
  searchValue?: string;
  onSearchChange?: (value: string | undefined) => void;
  searchPlaceholder?: string;

  // Sort
  sort?: SortState;
  onSortChange?: (sort: SortState | undefined) => void;

  // Pagination
  serverPagination?: ServerPaginationConfig;

  // Column visibility
  hideableColumns?: string[];

  // Clear all
  onClearAll?: () => void;
  hasActiveFilters?: boolean;

  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityListShell<T>({
  title,
  icon,
  description,
  action,
  data,
  isLoading,
  isError,
  onRetry,
  columns,
  getRowKey,
  onRowClick,
  filterConfig,
  filterValues,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  sort,
  onSortChange,
  serverPagination,
  hideableColumns,
  onClearAll,
  hasActiveFilters,
  emptyTitle = 'No items',
  emptyDescription = 'No items match your current filters.',
}: EntityListShellProps<T>) {
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const handleColumnVisibilityChange = useCallback((key: string, visible: boolean) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: visible }));
  }, []);

  const columnVisConfig = hideableColumns
    ? columns
        .filter((col) => hideableColumns.includes(col.key))
        .map((col) => ({
          key: col.key,
          label: col.header,
          visible: columnVisibility[col.key] !== false,
        }))
    : undefined;

  // Error state
  if (isError) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader title={title} icon={icon} description={description} action={action} />
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load {title.toLowerCase()}</p>
            <p className="text-xs text-muted-foreground">An error occurred while fetching data.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const showToolbar =
    onSearchChange || (filterConfig && filterConfig.length > 0) || columnVisConfig;

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={title} icon={icon} description={description} action={action} />

      {showToolbar && (
        <FilterToolbar
          filters={filterConfig}
          filterValues={filterValues}
          onFilterChange={onFilterChange}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          columns={columnVisConfig}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onClearAll={onClearAll}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        sort={sort}
        onSortChange={onSortChange}
        serverPagination={serverPagination}
        columnVisibility={columnVisibility}
        empty={<EmptyState title={emptyTitle} description={emptyDescription} />}
      />
    </div>
  );
}
