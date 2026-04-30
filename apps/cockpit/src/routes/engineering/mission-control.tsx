import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { AgentObservabilityBoard } from '../explore/observability';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/engineering/mission-control',
  component: AgentObservabilityBoard,
});
