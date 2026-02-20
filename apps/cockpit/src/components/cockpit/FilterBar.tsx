import { cn } from '@/lib/utils'

export function FilterBar({
  filters,
  active,
  onToggle,
}: {
  filters: { id: string; label: string }[]
  active: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
      {filters.map((filter) => {
        const isActive = active.includes(filter.id)
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onToggle(filter.id)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full border-2 px-3 py-1 text-xs font-black transition-colors',
              isActive
                ? 'border-[rgb(var(--primary))] bg-white text-[rgb(var(--primary))]'
                : 'border-[rgb(var(--border))] bg-white text-[rgb(var(--foreground))] hover:bg-gray-50',
            )}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
