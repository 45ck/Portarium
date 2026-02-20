import { Badge } from '@/components/ui/badge'
import { Hand, UserCheck, Users, Zap } from 'lucide-react'
import type { RunSummary } from '@portarium/cockpit-types'

type ExecutionTier = RunSummary['executionTier']

const tierConfig: Record<
  ExecutionTier,
  {
    variant: 'default' | 'info' | 'warn' | 'muted'
    label: string
    icon: typeof Zap
  }
> = {
  Auto: { variant: 'default', label: 'Auto', icon: Zap },
  Assisted: { variant: 'info', label: 'Assisted', icon: Users },
  HumanApprove: { variant: 'warn', label: 'Human Approve', icon: UserCheck },
  ManualOnly: { variant: 'muted', label: 'Manual Only', icon: Hand },
}

export function ExecutionTierBadge({ tier }: { tier: ExecutionTier }) {
  const { variant, label, icon: Icon } = tierConfig[tier]

  return (
    <Badge variant={variant} aria-label={label}>
      <Icon className="mr-1 inline-block h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  )
}
