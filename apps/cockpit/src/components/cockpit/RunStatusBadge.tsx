import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RunStatus } from '@portarium/cockpit-types'

const statusConfig: Record<
  RunStatus,
  { variant: 'default' | 'ok' | 'warn' | 'danger' | 'info' | 'muted'; label: string }
> = {
  Pending: { variant: 'default', label: 'Pending' },
  Running: { variant: 'info', label: 'Running' },
  WaitingForApproval: { variant: 'warn', label: 'Awaiting Approval' },
  Paused: { variant: 'muted', label: 'Paused' },
  Succeeded: { variant: 'ok', label: 'Succeeded' },
  Failed: { variant: 'danger', label: 'Failed' },
  Cancelled: { variant: 'muted', label: 'Cancelled' },
}

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const { variant, label } = statusConfig[status]

  return (
    <Badge
      variant={variant}
      aria-label={label}
      className={cn(
        'relative',
        status === 'Running' && 'overflow-visible',
      )}
    >
      {status === 'Running' && (
        <span className="absolute -inset-px animate-ping rounded-full border-2 border-[rgb(var(--status-info))] opacity-40" />
      )}
      {label}
    </Badge>
  )
}
