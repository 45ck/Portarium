import { describe, expect, it } from 'vitest';
import { COCKPIT_EXTENSION_FIXTURES, NEUTRAL_REFERENCE_EXTENSION } from './fixtures';
import {
  canAccessExtensionRoute,
  resolveCockpitExtensionRegistry,
  selectExtensionCommands,
  selectExtensionNavItems,
  selectExtensionRoutes,
} from './registry';
import type { CockpitExtensionManifest, CockpitExtensionRouteModuleLoader } from './types';

const neutralRouteLoaders = Object.fromEntries(
  NEUTRAL_REFERENCE_EXTENSION.routes.map((route) => [
    route.id,
    (() => Promise.resolve({})) satisfies CockpitExtensionRouteModuleLoader,
  ]),
);

const neutralAccessContext = {
  availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
  availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
} as const;

function cloneExtension(
  overrides: Partial<CockpitExtensionManifest> = {},
): CockpitExtensionManifest {
  return {
    ...NEUTRAL_REFERENCE_EXTENSION,
    personas: [...NEUTRAL_REFERENCE_EXTENSION.personas],
    routes: [...NEUTRAL_REFERENCE_EXTENSION.routes],
    navItems: [...NEUTRAL_REFERENCE_EXTENSION.navItems],
    commands: [...NEUTRAL_REFERENCE_EXTENSION.commands],
    ...overrides,
  };
}

describe('cockpit extension registry', () => {
  it('keeps the neutral fixture catalog aligned to the installed reference manifest', () => {
    expect(COCKPIT_EXTENSION_FIXTURES).toEqual([NEUTRAL_REFERENCE_EXTENSION]);
    expect(NEUTRAL_REFERENCE_EXTENSION.routes.map((route) => route.id)).toEqual([
      'example-reference-overview',
      'example-reference-review',
    ]);
  });

  it('resolves enabled extensions when pack activation is present', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('enabled');
    expect(registry.routes).toEqual(NEUTRAL_REFERENCE_EXTENSION.routes);
    expect(registry.navItems).toHaveLength(1);
    expect(registry.commands).toHaveLength(1);
  });

  it('keeps quarantined extensions out of routes, navigation, and commands', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      quarantinedExtensionIds: [NEUTRAL_REFERENCE_EXTENSION.id],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('quarantined');
    expect(registry.extensions[0]?.disableReasons?.[0]?.code).toBe('security-quarantine');
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('hides installed extensions when pack activation is absent', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: [],
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.extensions[0]?.disableReasons).toEqual([
      expect.objectContaining({
        code: 'workspace-pack-inactive',
        message: expect.stringContaining('example.reference'),
      }),
    ]);
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('hides installed extensions when workspace pack activation is only partially satisfied', () => {
    const partial = cloneExtension({
      packIds: ['example.reference', 'example.addon'],
    });

    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [partial],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.extensions[0]?.disableReasons).toEqual([
      expect.objectContaining({
        code: 'workspace-pack-inactive',
        message: expect.stringContaining('example.addon'),
      }),
    ]);
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on unknown workspace pack activation keys', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference', 'unknown.pack'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([
      expect.objectContaining({
        code: 'unknown-pack-activation',
        itemId: 'unknown.pack',
      }),
    ]);
    expect(registry.extensions[0]?.status).toBe('enabled');
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on duplicate extension, route, path, command, and shortcut ids', () => {
    const duplicate = cloneExtension({
      id: NEUTRAL_REFERENCE_EXTENSION.id,
      owner: 'portarium-test',
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION, duplicate],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
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

  it('fails all public surfaces closed when active extensions conflict on route ids or paths', () => {
    const duplicate = cloneExtension({
      id: 'example.reference.duplicate',
      routes: NEUTRAL_REFERENCE_EXTENSION.routes.map((route) => ({ ...route })),
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION, duplicate],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions.map((extension) => extension.status)).toEqual([
      'enabled',
      'invalid',
    ]);
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['duplicate-route-id', 'duplicate-route-path']),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on invalid surfaces and icons', () => {
    const invalid = cloneExtension({
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          icon: 'unknown-icon' as never,
          surfaces: ['sidebar', 'unknown-surface' as never],
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-icon', 'invalid-surface']),
    );
    expect(registry.navItems).toEqual([]);
  });

  it('fails closed on invalid personas and privacy classes', () => {
    const invalid = cloneExtension({
      personas: ['Guest' as never],
      routes: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!,
          guard: {
            ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!.guard,
            personas: ['Guest' as never],
            privacyClasses: ['unknown-privacy' as never],
          },
        },
      ],
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          personas: ['Guest' as never],
        },
      ],
      commands: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!,
          guard: {
            ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!.guard,
            personas: ['Guest' as never],
          },
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-persona', 'invalid-privacy-class']),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed when surfaced routes do not declare host guard metadata', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!,
          guard: undefined as never,
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toContain('missing-route-guard');
    expect(registry.routes).toEqual([]);
  });

  it('fails closed when route or command guards omit persona metadata', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!,
          guard: {
            ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!.guard,
            personas: [],
          },
        },
      ],
      commands: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!,
          guard: {
            ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!.guard,
            personas: [],
          },
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['missing-route-guard', 'missing-command-guard']),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed on routes outside the external boundary and parameterized nav targets', () => {
    const invalid = cloneExtension({
      routes: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.routes[0]!,
          path: '/config/settings',
        },
      ],
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          to: '/external/example-reference/reviews/$proposalId',
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toEqual(
      expect.arrayContaining(['invalid-external-path', 'invalid-direct-nav-target']),
    );
    expect(registry.routes).toEqual([]);
  });

  it('fails closed when direct nav targets do not match referenced external routes', () => {
    const invalid = cloneExtension({
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          to: '/config/settings',
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toContain('invalid-direct-nav-target');
    expect(registry.navItems).toEqual([]);
  });

  it('fails closed when nav items and commands reference missing routes', () => {
    const invalid = cloneExtension({
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          routeId: 'missing-route',
        },
      ],
      commands: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!,
          routeId: 'missing-route',
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems.map((problem) => problem.code)).toContain('missing-route');
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed when an active route lacks a compile-time module loader', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: {
        [NEUTRAL_REFERENCE_EXTENSION.routes[0]!.id]: () => Promise.resolve({}),
      },
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-route-module',
          itemId: NEUTRAL_REFERENCE_EXTENSION.routes[1]!.id,
          message: expect.stringContaining('compile-time route module loader'),
        }),
      ]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed when an active extension declares no pack activation keys', () => {
    const invalid = cloneExtension({
      packIds: [],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalid],
      activePackIds: [],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'missing-pack-activation' })]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('keeps disabled extensions out of validation namespaces and public surfaces', () => {
    const disabledDuplicate = cloneExtension({
      id: 'example.disabled-reference',
      packIds: ['example.disabled-pack'],
      routes: NEUTRAL_REFERENCE_EXTENSION.routes.map((route) => ({ ...route })),
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          id: NEUTRAL_REFERENCE_EXTENSION.navItems[0]!.id,
          routeId: NEUTRAL_REFERENCE_EXTENSION.routes[1]!.id,
          to: NEUTRAL_REFERENCE_EXTENSION.routes[1]!.path,
          icon: 'unknown-icon' as never,
        },
      ],
      commands: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!,
          id: NEUTRAL_REFERENCE_EXTENSION.commands[0]!.id,
          shortcut: NEUTRAL_REFERENCE_EXTENSION.commands[0]!.shortcut,
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION, disabledDuplicate],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions.map((extension) => extension.status)).toEqual([
      'enabled',
      'disabled',
    ]);
    expect(registry.routes).toEqual(NEUTRAL_REFERENCE_EXTENSION.routes);
    expect(registry.navItems).toEqual(NEUTRAL_REFERENCE_EXTENSION.navItems);
    expect(registry.commands).toEqual(NEUTRAL_REFERENCE_EXTENSION.commands);
  });

  it('disables active extensions when manifest capabilities or API scopes are unavailable', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      availableCapabilities: ['extension:read'],
      availableApiScopes: ['extensions.read'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.extensions[0]?.disableReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-capability' }),
        expect.objectContaining({ code: 'missing-api-scope' }),
      ]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed when active extension availability context is omitted', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      routeLoaders: neutralRouteLoaders,
    });

    expect(registry.problems).toEqual([]);
    expect(registry.extensions[0]?.status).toBe('disabled');
    expect(registry.extensions[0]?.disableReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-capability' }),
        expect.objectContaining({ code: 'missing-api-scope' }),
      ]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('fails closed when installed route module keys do not match manifest routes', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: {
        [NEUTRAL_REFERENCE_EXTENSION.routes[0]!.id]:
          neutralRouteLoaders[NEUTRAL_REFERENCE_EXTENSION.routes[0]!.id],
        'example-reference-uninstalled-route': () => Promise.resolve({}),
      },
    });

    expect(registry.extensions[0]?.status).toBe('invalid');
    expect(registry.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-route-module',
          itemId: NEUTRAL_REFERENCE_EXTENSION.routes[1]!.id,
        }),
      ]),
    );
    expect(registry.routes).toEqual([]);
    expect(registry.navItems).toEqual([]);
    expect(registry.commands).toEqual([]);
  });

  it('filters routes, nav items, and commands through the same capability and scope model', () => {
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(selectExtensionRoutes(registry, { persona: 'Operator' })).toEqual([]);
    expect(
      selectExtensionRoutes(registry, {
        persona: 'Operator',
        ...neutralAccessContext,
      }),
    ).toHaveLength(2);
    expect(
      selectExtensionRoutes(registry, {
        persona: 'Operator',
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
      }).map((route) => route.id),
    ).toEqual(['example-reference-overview']);
    expect(
      selectExtensionNavItems(registry, 'sidebar', 'Operator', {
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
      }).map((item) => item.id),
    ).toEqual(['example-reference-overview-nav']);
    expect(
      selectExtensionCommands(registry, 'Operator', {
        availableCapabilities: [],
        availableApiScopes: ['extensions.read'],
      }),
    ).toEqual([]);
  });

  it('applies command guard personas in addition to route guard personas', () => {
    const approverOnly = cloneExtension({
      commands: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!,
          guard: {
            ...NEUTRAL_REFERENCE_EXTENSION.commands[0]!.guard,
            personas: ['Approver'],
          },
        },
      ],
    });
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [approverOnly],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    expect(
      selectExtensionCommands(registry, 'Operator', {
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
      }),
    ).toEqual([]);
    expect(
      selectExtensionCommands(registry, 'Approver', {
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
      }),
    ).toEqual(approverOnly.commands);
  });

  it('honors server-issued persona grants when evaluating route access', () => {
    expect(
      canAccessExtensionRoute(NEUTRAL_REFERENCE_EXTENSION.routes[0]!, {
        persona: 'Operator',
        availablePersonas: ['Auditor'],
        ...neutralAccessContext,
      }),
    ).toEqual({
      allowed: false,
      denials: [{ code: 'persona' }],
    });

    expect(
      canAccessExtensionRoute(NEUTRAL_REFERENCE_EXTENSION.routes[0]!, {
        persona: 'Operator',
        availablePersonas: ['Operator'],
        ...neutralAccessContext,
      }),
    ).toEqual({
      allowed: true,
      denials: [],
    });
  });

  it('fails closed when persona context is omitted for a guarded route', () => {
    expect(
      canAccessExtensionRoute(NEUTRAL_REFERENCE_EXTENSION.routes[0]!, neutralAccessContext),
    ).toEqual({
      allowed: false,
      denials: [{ code: 'persona' }],
    });
  });

  it('reports forbidden route access without exposing domain-specific assumptions', () => {
    const decision = canAccessExtensionRoute(NEUTRAL_REFERENCE_EXTENSION.routes[0]!, {
      persona: 'Operator',
      availableCapabilities: [],
      availableApiScopes: [],
    });

    expect(decision).toEqual({
      allowed: false,
      denials: [
        { code: 'missing-capability', missing: ['extension:read'] },
        { code: 'missing-api-scope', missing: ['extensions.read'] },
      ],
    });
  });

  it('fails closed when guarded access is evaluated without capability or scope context', () => {
    const decision = canAccessExtensionRoute(NEUTRAL_REFERENCE_EXTENSION.routes[0]!, {
      persona: 'Operator',
    });

    expect(decision).toEqual({
      allowed: false,
      denials: [
        { code: 'missing-capability', missing: ['extension:read'] },
        { code: 'missing-api-scope', missing: ['extensions.read'] },
      ],
    });
  });
});
