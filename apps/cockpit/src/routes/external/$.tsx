import { createRoute, useRouterState } from '@tanstack/react-router';
import { ExternalRouteHost } from '@/components/cockpit/extensions/external-route-host';
import { Route as rootRoute } from '../__root';

function ExternalRoutePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return <ExternalRouteHost pathname={pathname} />;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/external/$',
  component: ExternalRoutePage,
});
