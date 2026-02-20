import { Badge } from '@/components/ui/badge'
import type { ApprovalStatus } from '@portarium/cockpit-types'

const statusConfig: Record<
  ApprovalStatus,
  { variant: 'warn' | 'ok' | 'danger' | 'info'; label: string }
> = {
  Pending: { variant: 'warn', label: 'Pending' },
  Approved: { variant: 'ok', label: 'Approved' },
  Denied: { variant: 'danger', label: 'Denied' },
  RequestChanges: { variant: 'info', label: 'Changes Requested' },
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const { variant, label } = statusConfig[status]

  return (
    <Badge variant={variant} aria-label={label}>
      {label}
    </Badge>
  )
}
