import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SodConstraintBadgeProps {
  constraint: string
  passed: boolean
}

export function SodConstraintBadge({ constraint, passed }: SodConstraintBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-[var(--radius-sm)] border-2 px-3 py-2 text-sm',
        passed
          ? 'border-[rgb(var(--status-ok))] text-[rgb(var(--status-ok))]'
          : 'border-[rgb(var(--status-danger))] text-[rgb(var(--status-danger))]',
      )}
      role="status"
      aria-label={`${constraint}: ${passed ? 'passed' : 'failed'}`}
    >
      {passed ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <X className="h-4 w-4 shrink-0" />
      )}
      <span className="font-bold">{constraint}</span>
      {!passed && (
        <span className="ml-auto text-xs font-bold">Constraint violated</span>
      )}
    </div>
  )
}
