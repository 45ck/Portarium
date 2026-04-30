import { createRoute, useRouterState } from '@tanstack/react-router';
import { ExternalRouteHost } from '@/components/cockpit/extensions/external-route-host';
import { INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS } from '@/lib/extensions/installed';
import { Route as rootRoute } from '../__root';

function InstalledExternalRoutePage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return <ExternalRouteHost pathname={pathname} />;
}

export const installedExternalRouteHostRoutes = INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.map(
  (definition) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: definition.path,
      component: InstalledExternalRoutePage,
    }),
);
