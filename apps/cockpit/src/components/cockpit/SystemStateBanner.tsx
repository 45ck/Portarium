import { Alert, AlertDescription } from '@/components/ui/alert'

type SystemState = 'normal' | 'empty' | 'misconfigured' | 'policy-blocked' | 'rbac-limited' | 'degraded'

interface SystemStateBannerProps {
  state: SystemState
}

const bannerConfig: Record<
  Exclude<SystemState, 'normal'>,
  { variant: 'info' | 'warn' | 'danger'; message: string }
> = {
  empty: {
    variant: 'info',
    message: 'No workflows configured yet. Add a workflow to get started.',
  },
  misconfigured: {
    variant: 'warn',
    message: 'Workspace is misconfigured \u2014 check adapter settings.',
  },
  'policy-blocked': {
    variant: 'danger',
    message: 'One or more actions are blocked by policy.',
  },
  'rbac-limited': {
    variant: 'warn',
    message: 'Your access is limited. Contact your workspace admin.',
  },
  degraded: {
    variant: 'warn',
    message: 'Realtime stream unavailable \u2014 showing cached data. Polling every 30s.',
  },
}

export function SystemStateBanner({ state }: SystemStateBannerProps) {
  if (state === 'normal') return null

  const { variant, message } = bannerConfig[state]

  return (
    <Alert variant={variant}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
