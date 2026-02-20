import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Plug } from 'lucide-react'

function GatewaysPage() {
  return (
    <div className="p-6">
      <EmptyState
        title="Gateways"
        description="Robotics gateway management coming soon."
        icon={<Plug className="h-12 w-12" />}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/gateways',
  component: GatewaysPage,
})
