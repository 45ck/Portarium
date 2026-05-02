import { describe, expect, it } from 'vitest';
import { EXAMPLE_REFERENCE_EXTENSION } from './example-reference/manifest';
import { resolveCockpitExtensionRouteHostDefinitions } from './route-host';
import type { CockpitExtensionManifest, CockpitExtensionRouteModuleLoader } from './types';

const accessContext = {
  availableCapabilities: ['extension:read', 'extension:inspect'],
  availableApiScopes: ['extensions.read', 'extensions.inspect'],
  availablePrivacyClasses: ['internal', 'restricted'],
} as const;

const routeLoaders = Object.fromEntries(
  EXAMPLE_REFERENCE_EXTENSION.routes.map((route) => [
    route.id,
    (() => Promise.resolve({})) satisfies CockpitExtensionRouteModuleLoader,
  ]),
);

function resolveHost(
  overrides: Partial<Parameters<typeof resolveCockpitExtensionRouteHostDefinitions>[0]> = {},
) {
  return resolveCockpitExtensionRouteHostDefinitions({
    installedExtensions: [EXAMPLE_REFERENCE_EXTENSION],
    activePackIds: ['example.reference'],
    ...accessContext,
    routeLoaders,
    ...overrides,
  });
}

function cloneExtension(
  overrides: Partial<CockpitExtensionManifest> = {},
): CockpitExtensionManifest {
  return {
    ...EXAMPLE_REFERENCE_EXTENSION,
    personas: [...EXAMPLE_REFERENCE_EXTENSION.personas],
    routes: [...EXAMPLE_REFERENCE_EXTENSION.routes],
    navItems: [...EXAMPLE_REFERENCE_EXTENSION.navItems],
    commands: [...EXAMPLE_REFERENCE_EXTENSION.commands],
    ...overrides,
  };
}

describe('cockpit extension route host definitions', () => {
  it('resolves deterministic compile-time route definitions from the installed registry', () => {
    const resolution = resolveHost();

    expect(resolution.problems).toEqual([]);
    expect(resolution.definitions).toEqual([
      {
        extensionId: 'example.reference',
        routeId: 'example-reference-detail',
        path: '/external/example-reference/details/$itemId',
      },
      {
        extensionId: 'example.reference',
        routeId: 'example-reference-overview',
        path: '/external/example-reference/overview',
      },
    ]);
  });

  it('mounts no partial route definitions when the registry has route conflicts', () => {
    const duplicate = cloneExtension({
      id: 'example.reference.duplicate',
      routes: EXAMPLE_REFERENCE_EXTENSION.routes.map((route) => ({ ...route })),
    });

    const resolution = resolveHost({
      installedExtensions: [EXAMPLE_REFERENCE_EXTENSION, duplicate],
    });

    expect(resolution.definitions).toEqual([]);
    expect(resolution.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['duplicate-route-id', 'duplicate-route-path']),
    );
  });

  it('mounts no partial route definitions when an active manifest route lacks a module', () => {
    const [firstRoute] = EXAMPLE_REFERENCE_EXTENSION.routes;
    if (!firstRoute) throw new Error('Expected reference route fixture.');

    const resolution = resolveHost({
      routeLoaders: {
        [firstRoute.id]: routeLoaders[firstRoute.id],
      },
    });

    expect(resolution.definitions).toEqual([]);
    expect(resolution.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-route-module',
          itemId: 'example-reference-detail',
        }),
      ]),
    );
  });

  it('mounts no partial route definitions for undeclared module loaders', () => {
    const resolution = resolveHost({
      routeLoaders: {
        ...routeLoaders,
        'example-reference-undeclared': () => Promise.resolve({}),
      },
    });

    expect(resolution.definitions).toEqual([]);
    expect(resolution.problems).toEqual([
      expect.objectContaining({
        code: 'undeclared-route-module',
        itemId: 'example-reference-undeclared',
      }),
    ]);
  });

  it('keeps core Cockpit route hosting valid with no installed extensions', () => {
    const resolution = resolveCockpitExtensionRouteHostDefinitions({
      installedExtensions: [],
      activePackIds: [],
      routeLoaders: {},
    });

    expect(resolution).toEqual({ definitions: [], problems: [] });
  });

  it('keeps core Cockpit route hosting valid when installed extensions are not enabled', () => {
    const resolution = resolveHost({
      activePackIds: [],
    });

    expect(resolution).toEqual({ definitions: [], problems: [] });
  });
});
