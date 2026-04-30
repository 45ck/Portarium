import { describe, expect, it } from 'vitest';
import { COCKPIT_EXTENSION_FIXTURES, NEUTRAL_OPS_EXTENSION } from './fixtures';
import { resolveCockpitExtensionRegistry } from './registry';
import type { CockpitExtensionManifest, CockpitExtensionRouteModuleLoader } from './types';

const neutralRouteLoaders = Object.fromEntries(
  NEUTRAL_OPS_EXTENSION.routes.map((route) => [
    route.id,
    (() => Promise.resolve({})) satisfies CockpitExtensionRouteModuleLoader,
  ]),
);

function cloneExtension(
  overrides: Partial<CockpitExtensionManifest> = {},
): CockpitExtensionManifest {
  return {
    ...NEUTRAL_OPS_EXTENSION,
    routes: [...NEUTRAL_OPS_EXTENSION.routes],
    navItems: [...NEUTRAL_OPS_EXTENSION.navItems],
    commands: [...NEUTRAL_OPS_EXTENSION.commands],
    ...overrides,
  };
}

describe('cockpit extension registry', () => {
  it('keeps the neutral fixture catalog aligned to the installed reference manifest', () => {
    expect(COCKPIT_EXTENSION_FIXTURES).toEqual([NEUTRAL_OPS_EXTENSION]);
    expect(NEUTRAL_OPS_EXTENSION.routes.map((route) => route.id)).toEqual([
      'example-ops-overview',
      'example-ops-action-review',
    ]);
  });

  it('resolves enabled extensions when pack activation is present', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('enabled');
    expect(registry.routes).toEqual(NEUTRAL_OPS_EXTENSION.routes);
    expect(registry.navItems).toHaveLength(1);
    expect(registry.commands).toHaveLength(1);
  });

  it('hides installed extensions when pack activation is absent', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION],
      activePackIds: [],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on duplicate extension, route, path, command, and shortcut ids', () => {
    const duplicate = cloneExtension({
      id: NEUTRAL_OPS_EXTENSION.id,
      owner: 'portarium-test',
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION, duplicate],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions.every((extension) => extension.status === 'invalid')).toBe(true);
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining([
        'duplicate-extension-id',
        'duplicate-route-id',
        'duplicate-route-path',
        'duplicate-nav-id',
        'duplicate-command-id',
        'duplicate-shortcut',
      ]),
    );
    expect(registry.routes).toEqual([]);
  });

  it('fails closed on invalid surfaces and icons', () => {
    const invalid = cloneExtension({
      navItems: [
        {
          ...NEUTRAL_OPS_EXTENSION.navItems[0]!,
          icon: 'unknown-icon' as never,
          surfaces: ['sidebar', 'unknown-surface' as never],
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-icon', 'invalid-surface']),
    );
    expect(registry.navItems).toEqual([]);
  });

  it('fails closed when surfaced routes do not declare host guard metadata', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_OPS_EXTENSION.routes[0]!,
          guard: undefined as never,
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toContain('missing-route-guard');
    expect(registry.routes).toEqual([]);
  });

  it('fails closed on routes outside the external boundary and parameterized nav targets', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_OPS_EXTENSION.routes[0]!,
          path: '/config/settings',
        },
      ],
      navItems: [
        {
          ...NEUTRAL_OPS_EXTENSION.navItems[0]!,
          to: '/external/example-ops/actions/$proposalId',
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-external-path', 'invalid-direct-nav-target']),
    );
    expect(registry.routes).toEqual([]);
  });

  it('fails closed when an active route lacks a compile-time module loader', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION],
      activePackIds: ['example.ops-demo'],
      routeLoaders: {
        [NEUTRAL_OPS_EXTENSION.routes[0]!.id]: () => Promise.resolve({}),
      },
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-route-module',
          itemId: NEUTRAL_OPS_EXTENSION.routes[1]!.id,
          message: expect.stringContaining('compile-time route module loader'),
        }),
      ]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('keeps disabled extensions out of validation namespaces and public surfaces', () => {
    const disabledDuplicate = cloneExtension({
      id: 'example.disabled-ops-demo',
      packIds: ['example.disabled-pack'],
      routes: NEUTRAL_OPS_EXTENSION.routes.map((route) => ({ ...route })),
      navItems: [
        {
          ...NEUTRAL_OPS_EXTENSION.navItems[0]!,
          id: NEUTRAL_OPS_EXTENSION.navItems[0]!.id,
          routeId: NEUTRAL_OPS_EXTENSION.routes[1]!.id,
          to: NEUTRAL_OPS_EXTENSION.routes[1]!.path,
          icon: 'unknown-icon' as never,
        },
      ],
      commands: [
        {
          ...NEUTRAL_OPS_EXTENSION.commands[0]!,
          id: NEUTRAL_OPS_EXTENSION.commands[0]!.id,
          shortcut: NEUTRAL_OPS_EXTENSION.commands[0]!.shortcut,
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_OPS_EXTENSION, disabledDuplicate],
      activePackIds: ['example.ops-demo'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual([
      'enabled',
      'disabled',
    ]);
    expect(registry.routes).toEqual(NEUTRAL_OPS_EXTENSION.routes);
    expect(registry.navItems).toEqual(NEUTRAL_OPS_EXTENSION.navItems);
    expect(registry.commands).toEqual(NEUTRAL_OPS_EXTENSION.commands);
  });
});
