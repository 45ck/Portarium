import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Map } from 'lucide-react'

function MissionsPage() {
  return (
    <div className="p-6">
      <EmptyState
        title="Missions"
        description="Mission planning and tracking coming soon."
        icon={<Map className="h-12 w-12" />}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/missions',
  component: MissionsPage,
})
