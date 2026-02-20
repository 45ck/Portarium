import type { HumanTaskStatus } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface HumanTaskStatusBadgeProps {
  status: HumanTaskStatus
}

const config: Record<HumanTaskStatus, { label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary'; className: string }> = {
  'pending':     { label: 'Pending',     variant: 'outline',  className: 'border-warning text-warning' },
  'assigned':    { label: 'Assigned',    variant: 'outline',  className: 'border-info text-info' },
  'in-progress': { label: 'In Progress', variant: 'default',  className: 'bg-info text-info-foreground' },
  'completed':   { label: 'Completed',   variant: 'default',  className: 'bg-success text-success-foreground' },
  'escalated':   { label: 'Escalated',   variant: 'destructive', className: '' },
}

export function HumanTaskStatusBadge({ status }: HumanTaskStatusBadgeProps) {
  const { label, variant, className } = config[status]
  return (
    <Badge variant={variant} className={cn('text-[10px]', className)}>
      {label}
    </Badge>
  )
}
