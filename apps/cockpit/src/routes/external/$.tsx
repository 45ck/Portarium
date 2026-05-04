import { createRoute, useRouterState } from '@tanstack/react-router';
import { ExternalRouteHost } from '@/components/cockpit/extensions/external-route-host';
import { Route as rootRoute } from '../__root';

function ExternalRoutePage() {
  const location = useRouterState({
    select: (state) => state.location,
  });

  return (
    <ExternalRouteHost
      pathname={location.pathname}
      searchParams={location.search}
      hash={location.hash}
    />
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/external/$',
  component: ExternalRoutePage,
});
