import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

export function KpiStat({
  label,
  value,
  trend,
  status,
}: {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  status?: 'ok' | 'warn' | 'danger'
}) {
  const borderColor = status
    ? {
        ok: 'border-[rgb(var(--status-ok))]',
        warn: 'border-[rgb(var(--status-warn))]',
        danger: 'border-[rgb(var(--status-danger))]',
      }[status]
    : 'border-[rgb(var(--border))]'

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border-2 bg-white p-3 shadow-[var(--shadow-card)]',
        borderColor,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl font-black">{value}</span>
        {trend === 'up' && (
          <TrendingUp className="h-5 w-5 text-[rgb(var(--status-ok))]" aria-label="Trending up" />
        )}
        {trend === 'down' && (
          <TrendingDown className="h-5 w-5 text-[rgb(var(--status-danger))]" aria-label="Trending down" />
        )}
      </div>
      <div className="text-xs font-black uppercase text-[rgb(var(--muted))]">
        {label}
      </div>
    </div>
  )
}
