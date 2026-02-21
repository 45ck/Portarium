import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, X, SlidersHorizontal } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilterFieldConfig {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

interface ColumnVisibilityConfig {
  key: string;
  label: string;
  visible: boolean;
}

interface FilterToolbarProps {
  filters?: FilterFieldConfig[];
  filterValues?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;
  searchValue?: string;
  onSearchChange?: (value: string | undefined) => void;
  searchPlaceholder?: string;
  columns?: ColumnVisibilityConfig[];
  onColumnVisibilityChange?: (key: string, visible: boolean) => void;
  onClearAll?: () => void;
  hasActiveFilters?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 300;

export function FilterToolbar({
  filters,
  filterValues,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  columns,
  onColumnVisibilityChange,
  onClearAll,
  hasActiveFilters,
}: FilterToolbarProps) {
  // Debounced search input
  const [localSearch, setLocalSearch] = useState(searchValue ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Sync external searchValue changes
  useEffect(() => {
    setLocalSearch(searchValue ?? '');
  }, [searchValue]);

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearchChange?.(value || undefined);
      }, DEBOUNCE_MS);
    },
    [onSearchChange],
  );

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search input */}
      {onSearchChange && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 w-[200px] pl-7 text-xs"
          />
        </div>
      )}

      {/* Filter dropdowns */}
      {filters?.map((filter) => (
        <Select
          key={filter.key}
          value={filterValues?.[filter.key] ?? 'all'}
          onValueChange={(v) => onFilterChange?.(filter.key, v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All {filter.label}
            </SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Column visibility dropdown */}
      {columns && columns.length > 0 && onColumnVisibilityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={col.visible}
                onCheckedChange={(checked) => onColumnVisibilityChange(col.key, Boolean(checked))}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Clear all button */}
      {hasActiveFilters && onClearAll && (
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onClearAll}>
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

export type { FilterFieldConfig, FilterToolbarProps, ColumnVisibilityConfig };
