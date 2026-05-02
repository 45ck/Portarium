import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from '../__root';
import { PolicyOverviewPage } from '@/components/cockpit/policy-overview';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config/policies',
  component: PolicyOverviewPage,
});
