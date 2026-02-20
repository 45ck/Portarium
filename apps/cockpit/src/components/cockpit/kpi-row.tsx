import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiStat {
  label: string
  value: string | number
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

interface KpiRowProps {
  stats: KpiStat[]
}

export function KpiRow({ stats }: KpiRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="shadow-none">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <div className="mt-0.5 flex items-end gap-1.5">
              <span className="text-2xl font-bold tabular-nums">{stat.value}</span>
              {stat.trend && stat.trendValue && (
                <span className={`flex items-center gap-0.5 text-xs mb-0.5 ${
                  stat.trend === 'up' ? 'text-success' : stat.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {stat.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {stat.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  {stat.trend === 'neutral' && <Minus className="h-3 w-3" />}
                  {stat.trendValue}
                </span>
              )}
            </div>
            {stat.description && <p className="text-[11px] text-muted-foreground">{stat.description}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export type { KpiStat, KpiRowProps }
