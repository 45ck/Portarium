import { createRouter } from '@tanstack/react-router'

// Root
import { Route as rootRoute } from './routes/__root'

// Index (redirect)
import { Route as indexRoute } from './routes/index'

// Dashboard
import { Route as dashboardRoute } from './routes/dashboard'

// Work Items
import { Route as workItemsRoute } from './routes/work-items/index'
import { Route as workItemDetailRoute } from './routes/work-items/$workItemId'

// Runs
import { Route as runsRoute } from './routes/runs/index'
import { Route as runDetailRoute } from './routes/runs/$runId'

// Approvals
import { Route as approvalsRoute } from './routes/approvals/index'
import { Route as approvalDetailRoute } from './routes/approvals/$approvalId'

// Evidence
import { Route as evidenceRoute } from './routes/evidence/index'

// Workforce
import { Route as workforceRoute } from './routes/workforce/index'
import { Route as workforceMemberRoute } from './routes/workforce/$memberId'
import { Route as workforceQueuesRoute } from './routes/workforce/queues'

// Config
import { Route as configAgentsRoute } from './routes/config/agents'
import { Route as configAdaptersRoute } from './routes/config/adapters'
import { Route as configSettingsRoute } from './routes/config/settings'

// Explore
import { Route as exploreObjectsRoute } from './routes/explore/objects'
import { Route as exploreEventsRoute } from './routes/explore/events'
import { Route as exploreObservabilityRoute } from './routes/explore/observability'
import { Route as exploreGovernanceRoute } from './routes/explore/governance'

// Robotics (stubs)
import { Route as roboticsRoute } from './routes/robotics/index'
import { Route as roboticsRobotsRoute } from './routes/robotics/robots'
import { Route as roboticsMissionsRoute } from './routes/robotics/missions'
import { Route as roboticsSafetyRoute } from './routes/robotics/safety'
import { Route as roboticsGatewaysRoute } from './routes/robotics/gateways'

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  workItemsRoute,
  workItemDetailRoute,
  runsRoute,
  runDetailRoute,
  approvalsRoute,
  approvalDetailRoute,
  evidenceRoute,
  workforceRoute,
  workforceMemberRoute,
  workforceQueuesRoute,
  configAgentsRoute,
  configAdaptersRoute,
  configSettingsRoute,
  exploreObjectsRoute,
  exploreEventsRoute,
  exploreObservabilityRoute,
  exploreGovernanceRoute,
  roboticsRoute,
  roboticsRobotsRoute,
  roboticsMissionsRoute,
  roboticsSafetyRoute,
  roboticsGatewaysRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
