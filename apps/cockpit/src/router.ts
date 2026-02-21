import { createRouter, type RouterHistory } from '@tanstack/react-router';

// Root
import { Route as rootRoute } from './routes/__root';

// Index (redirect)
import { Route as indexRoute } from './routes/index';

// Inbox
import { Route as inboxRoute } from './routes/inbox';

// Dashboard
import { Route as dashboardRoute } from './routes/dashboard';

// Work Items
import { Route as workItemsRoute } from './routes/work-items/index';
import { Route as workItemDetailRoute } from './routes/work-items/$workItemId';

// Runs
import { Route as runsRoute } from './routes/runs/index';
import { Route as runDetailRoute } from './routes/runs/$runId';

// Workflows
import { Route as workflowsRoute } from './routes/workflows/index';
import { Route as workflowDetailRoute } from './routes/workflows/$workflowId';
import { Route as workflowEditRoute } from './routes/workflows/$workflowId.edit';
import { Route as workflowBuilderRoute } from './routes/workflows/builder';

// Approvals
import { Route as approvalsRoute } from './routes/approvals/index';
import { Route as approvalDetailRoute } from './routes/approvals/$approvalId';

// Evidence
import { Route as evidenceRoute } from './routes/evidence/index';

// Workforce
import { Route as workforceRoute } from './routes/workforce/index';
import { Route as workforceMemberRoute } from './routes/workforce/$memberId';
import { Route as workforceQueuesRoute } from './routes/workforce/queues';

// Config
import { Route as configAgentsRoute } from './routes/config/agents';
import { Route as configAgentDetailRoute } from './routes/config/agent-detail';
import { Route as configAdaptersRoute } from './routes/config/adapters';
import { Route as configCredentialsRoute } from './routes/config/credentials';
import { Route as configUsersRoute } from './routes/config/users';
import { Route as configSettingsRoute } from './routes/config/settings';

// Explore
import { Route as exploreObjectsRoute } from './routes/explore/objects';
import { Route as exploreEventsRoute } from './routes/explore/events';
import { Route as exploreObservabilityRoute } from './routes/explore/observability';
import { Route as exploreGovernanceRoute } from './routes/explore/governance';

// Robotics
import { Route as roboticsRoute } from './routes/robotics/index';
import { Route as roboticsMapRoute } from './routes/robotics/map';
import { Route as roboticsRobotsRoute } from './routes/robotics/robots';
import { Route as roboticsMissionsRoute } from './routes/robotics/missions';
import { Route as roboticsSafetyRoute } from './routes/robotics/safety';
import { Route as roboticsGatewaysRoute } from './routes/robotics/gateways';
import { Route as roboticsRobotDetailRoute } from './routes/robotics/$robotId';
import { Route as roboticsMissionDetailRoute } from './routes/robotics/missions/$missionId';

export const routeTree = rootRoute.addChildren([
  indexRoute,
  inboxRoute,
  dashboardRoute,
  workItemsRoute,
  workItemDetailRoute,
  runsRoute,
  runDetailRoute,
  workflowsRoute,
  workflowDetailRoute,
  workflowEditRoute,
  workflowBuilderRoute,
  approvalsRoute,
  approvalDetailRoute,
  evidenceRoute,
  workforceRoute,
  workforceMemberRoute,
  workforceQueuesRoute,
  configAgentsRoute,
  configAgentDetailRoute,
  configAdaptersRoute,
  configCredentialsRoute,
  configUsersRoute,
  configSettingsRoute,
  exploreObjectsRoute,
  exploreEventsRoute,
  exploreObservabilityRoute,
  exploreGovernanceRoute,
  roboticsRoute,
  roboticsMapRoute,
  roboticsRobotsRoute,
  roboticsMissionsRoute,
  roboticsSafetyRoute,
  roboticsGatewaysRoute,
  roboticsRobotDetailRoute,
  roboticsMissionDetailRoute,
]);

export function createCockpitRouter(options?: { history?: RouterHistory }) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    ...(options?.history ? { history: options.history } : {}),
  });
}

export const router = createCockpitRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
