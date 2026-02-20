import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Bot } from 'lucide-react'

function RobotsPage() {
  return (
    <div className="p-6">
      <EmptyState
        title="Robots"
        description="Robot fleet management coming soon."
        icon={<Bot className="h-12 w-12" />}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics/robots',
  component: RobotsPage,
})
