import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertTriangle, Siren, Wrench } from 'lucide-react'

type WorkspaceState = 'healthy' | 'degraded' | 'incident' | 'maintenance'

interface SystemStateBannerProps {
  state: WorkspaceState
  message?: string
}

const config: Record<WorkspaceState, {
  icon: React.ElementType
  title: string
  variant: 'default' | 'destructive' | 'success' | 'warning'
}> = {
  healthy:     { icon: CheckCircle,   title: 'All systems operational',     variant: 'success' },
  degraded:    { icon: AlertTriangle, title: 'Some systems degraded',       variant: 'warning' },
  incident:    { icon: Siren,         title: 'Active incident in progress', variant: 'destructive' },
  maintenance: { icon: Wrench,        title: 'Maintenance window active',   variant: 'default' },
}

export function SystemStateBanner({ state, message }: SystemStateBannerProps) {
  const { icon: Icon, title, variant } = config[state]
  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      {message && <AlertDescription>{message}</AlertDescription>}
    </Alert>
  )
}

export type { WorkspaceState, SystemStateBannerProps }
