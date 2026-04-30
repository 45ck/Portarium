import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  INSTALLED_COCKPIT_EXTENSION_MODULES,
  INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS,
  INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS,
  INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
  INSTALLED_COCKPIT_ROUTE_PATHS,
  resolveInstalledCockpitExtensionRegistry,
} from './installed';

describe('installed cockpit extension catalog', () => {
  it('keeps the authoritative compile-time installed catalog hidden without workspace activation', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: DEFAULT_ACTIVE_EXTENSION_PACK_IDS,
      ...DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual(['disabled']);
    expect(registry.extensions[0]?.disableReasons).toEqual([
      expect.objectContaining({ code: 'workspace-pack-inactive' }),
    ]);
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('resolves enabled installed extensions only from workspace activation state', () => {
    const registry = resolveInstalledCockpitExtensionRegistry({
      activePackIds: ['example.reference'],
      availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
      availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual(['enabled']);
    expect(registry.routes.map((route) => route.id)).toEqual([
      'example-reference-overview',
      'example-reference-review',
    ]);
  });

  it('keeps installed route paths aligned with installed manifest routes', () => {
    for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
      for (const route of extension.manifest.routes) {
        expect(INSTALLED_COCKPIT_ROUTE_PATHS.get(route.id)).toBe(route.path);
      }
    }
  });

  it('keeps installed route modules in exact lockstep with manifest route ids', () => {
    const manifestRouteIds = INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
      extension.manifest.routes.map((route) => route.id),
    ).sort();
    const moduleRouteIds = INSTALLED_COCKPIT_EXTENSION_MODULES.flatMap((extension) =>
      extension.routeModules.map((routeModule) => routeModule.routeId),
    ).sort();

    expect(Object.keys(INSTALLED_COCKPIT_ROUTE_LOADERS).sort()).toEqual(manifestRouteIds);
    expect(moduleRouteIds).toEqual(manifestRouteIds);
  });

  it('exposes deterministic installed external route id and path pairs', () => {
    expect(INSTALLED_COCKPIT_ROUTE_HOST_PACK_IDS).toEqual(['example.reference']);
    expect(INSTALLED_COCKPIT_ROUTE_HOST_PROBLEMS).toEqual([]);
    expect(
      INSTALLED_COCKPIT_ROUTE_HOST_DEFINITIONS.map((definition) => [
        definition.routeId,
        definition.path,
      ]),
    ).toEqual([
      ['example-reference-overview', '/external/example-reference/overview'],
      ['example-reference-review', '/external/example-reference/reviews/$proposalId'],
    ]);
  });
});
