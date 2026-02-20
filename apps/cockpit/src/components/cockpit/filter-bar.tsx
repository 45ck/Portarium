import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v && v !== 'all');

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={values[filter.key] || 'all'}
          onValueChange={(v) => onChange(filter.key, v)}
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
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => filters.forEach((f) => onChange(f.key, 'all'))}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

export type { FilterOption, FilterConfig, FilterBarProps };
