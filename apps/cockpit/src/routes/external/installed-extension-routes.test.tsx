// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS } from '@/lib/extensions/installed';
import { routeTree } from '@/router';
import { installedExternalRouteHostRoutes } from './installed-extension-routes';

describe('installed external route registration', () => {
  it('registers every installed external host definition before the catch-all route', () => {
    expect(installedExternalRouteHostRoutes).toHaveLength(
      INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.length,
    );
    expect(installedExternalRouteHostRoutes.map((route) => routePath(route))).toEqual(
      INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.map((definition) => definition.path),
    );

    const children = routeTree.children ?? [];
    const installedIndexes = INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.map((definition) =>
      children.findIndex((route) => routePath(route) === definition.path),
    );
    const catchAllIndex = children.findIndex((route) => routePath(route) === '/external/$');

    expect(installedIndexes.every((index) => index >= 0)).toBe(true);
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(Math.max(...installedIndexes)).toBeLessThan(catchAllIndex);
  });
});

function routePath(route: {
  options: unknown;
  path?: string;
  fullPath?: string;
}): string | undefined {
  const options = route.options as { path?: string };
  return options.path ?? route.path ?? route.fullPath;
}
