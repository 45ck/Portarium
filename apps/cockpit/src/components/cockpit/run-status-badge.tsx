import type { RunStatus } from '@portarium/cockpit-types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Clock,
  Play,
  AlertCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Ban,
} from 'lucide-react'

interface RunStatusBadgeProps {
  status: RunStatus
}

const config: Record<RunStatus, { icon: React.ElementType; label: string; className: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  Pending:             { icon: Clock,        label: 'Pending',       variant: 'secondary',    className: '' },
  Running:             { icon: Play,         label: 'Running',       variant: 'default',      className: 'bg-info text-info-foreground' },
  WaitingForApproval:  { icon: AlertCircle,  label: 'Waiting',       variant: 'outline',      className: 'border-warning text-warning' },
  Paused:              { icon: PauseCircle,  label: 'Paused',        variant: 'secondary',    className: '' },
  Succeeded:           { icon: CheckCircle2, label: 'Succeeded',     variant: 'default',      className: 'bg-success text-success-foreground' },
  Failed:              { icon: XCircle,      label: 'Failed',        variant: 'destructive',  className: '' },
  Cancelled:           { icon: Ban,          label: 'Cancelled',     variant: 'secondary',    className: '' },
}

export function RunStatusBadge({ status }: RunStatusBadgeProps) {
  const { icon: Icon, label, variant, className } = config[status]
  return (
    <Badge variant={variant} className={cn('text-[10px]', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
