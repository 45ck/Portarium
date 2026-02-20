import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Bot } from 'lucide-react'

function RoboticsIndexPage() {
  return (
    <div className="p-6">
      <EmptyState
        title="Robotics"
        description="Robotics integration coming soon. Connect physical robots, manage missions, and monitor safety systems."
        icon={<Bot className="h-12 w-12" />}
      />
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/robotics',
  component: RoboticsIndexPage,
})
