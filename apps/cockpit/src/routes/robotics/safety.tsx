import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { EmptyState } from '@/components/cockpit/empty-state'
import { ShieldAlert } from 'lucide-react'

function SafetyPage() {
  return (
    <div className="p-6">
      <EmptyState
        title="Safety Systems"
        description="Safety monitoring and override controls coming soon."
        icon={<ShieldAlert className="h-12 w-12" />}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/safety',
  component: SafetyPage,
})
