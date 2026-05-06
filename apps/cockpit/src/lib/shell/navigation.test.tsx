import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEUTRAL_REFERENCE_EXTENSION } from '@/lib/extensions/fixtures';
import { resolveCockpitExtensionRegistry } from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  CockpitExtensionManifest,
  CockpitExtensionRouteModuleLoader,
} from '@/lib/extensions/types';
import {
  PORTARIUM_COCKPIT_SHELL_PROFILE,
  isCockpitShellGlobalActionVisible,
  projectCockpitGChordMap,
  projectCockpitShellNavigation,
  resolveCockpitShellProfile,
  type CockpitShellProfile,
} from '@/lib/shell/navigation';

function createRouteLoaders(
  manifest: CockpitExtensionManifest,
): Readonly<Record<string, CockpitExtensionRouteModuleLoader>> {
  return Object.fromEntries(
    manifest.routes.map((route) => [
      route.id,
      (() => Promise.resolve({})) satisfies CockpitExtensionRouteModuleLoader,
    ]),
  ) as Readonly<Record<string, CockpitExtensionRouteModuleLoader>>;
}

const neutralRouteLoaders = createRouteLoaders(NEUTRAL_REFERENCE_EXTENSION);

const allPersonas = ['Operator', 'Approver', 'Auditor', 'Admin'] as const;
const opsReferenceCapabilities = [
  'ops.ticket.read',
  'ops.map.read',
  'ops.source.read',
] as const;
const opsReferenceApiScopes = ['ops.read'] as const;
const opsReferenceExtension = {
  manifestVersion: 1,
  id: 'reference.ops',
  owner: 'ops-reference-provider',
  version: '0.1.0',
  displayName: 'Ops Reference',
  description:
    'Read-only operations workspace for ticket triage, campus context, and source evidence.',
  packIds: ['reference.ops'],
  personas: allPersonas,
  requiredCapabilities: opsReferenceCapabilities,
  requiredApiScopes: opsReferenceApiScopes,
  routes: [
    {
      id: 'ops-reference-tickets',
      path: '/external/ops-reference/tickets',
      title: 'Ticket Queue',
      description: 'Read-only ticket queue for operations triage.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['ops.ticket.read'],
        requiredApiScopes: opsReferenceApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['ops.tickets.read'],
    },
    {
      id: 'ops-reference-campus-map',
      path: '/external/ops-reference/map',
      title: 'Campus Map',
      description: 'Read-only campus map context for operations.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['ops.map.read'],
        requiredApiScopes: opsReferenceApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['ops.map.read'],
    },
    {
      id: 'ops-reference-data-sources',
      path: '/external/ops-reference',
      title: 'Data Sources',
      description: 'Read-only source catalogue for operations evidence.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['ops.source.read'],
        requiredApiScopes: opsReferenceApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['ops.sources.read'],
    },
  ],
  navItems: [
    {
      id: 'ops-reference-tickets-nav',
      title: 'Ticket Queue',
      routeId: 'ops-reference-tickets',
      to: '/external/ops-reference/tickets',
      icon: 'clipboard-check',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['ops.ticket.read'],
      requiredApiScopes: opsReferenceApiScopes,
      mobilePrimary: true,
    },
    {
      id: 'ops-reference-campus-map-nav',
      title: 'Campus Map',
      routeId: 'ops-reference-campus-map',
      to: '/external/ops-reference/map',
      icon: 'map',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['ops.map.read'],
      requiredApiScopes: opsReferenceApiScopes,
    },
    {
      id: 'ops-reference-data-sources-nav',
      title: 'Data Sources',
      routeId: 'ops-reference-data-sources',
      to: '/external/ops-reference',
      icon: 'boxes',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['ops.source.read'],
      requiredApiScopes: opsReferenceApiScopes,
    },
  ],
  commands: [
    {
      id: 'ops-reference-open-tickets',
      title: 'Open ops queue',
      routeId: 'ops-reference-tickets',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['ops.ticket.read'],
        requiredApiScopes: opsReferenceApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['ops.tickets.read'],
      requiredCapabilities: ['ops.ticket.read'],
      requiredApiScopes: opsReferenceApiScopes,
      shortcut: 'G T',
    },
  ],
  governance: {
    identity: {
      publisher: 'ops-reference-provider',
      attestation: {
        kind: 'source-review',
        subject: 'packages/ops-reference-extension/src',
        digestSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        issuedAtIso: '2026-05-04T00:00:00.000Z',
      },
    },
    versionPin: {
      packageName: '@example/ops-reference-extension',
      version: '0.1.0',
      sourceRef: 'packages/ops-reference-extension',
    },
    permissions: [
      {
        id: 'ops.tickets.read',
        kind: 'data-query',
        title: 'Read operations tickets',
        requiredCapabilities: ['ops.ticket.read'],
        requiredApiScopes: opsReferenceApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.ops.tickets.read'],
      },
      {
        id: 'ops.map.read',
        kind: 'data-query',
        title: 'Read operations map context',
        requiredCapabilities: ['ops.map.read'],
        requiredApiScopes: opsReferenceApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.ops.map.read'],
      },
      {
        id: 'ops.sources.read',
        kind: 'data-query',
        title: 'Read operations source catalogue',
        requiredCapabilities: ['ops.source.read'],
        requiredApiScopes: opsReferenceApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.ops.sources.read'],
      },
    ],
    lifecycle: {
      emergencyDisable: {
        mode: 'activation-source',
        suppresses: ['routes', 'navigation', 'commands', 'shortcuts', 'data-loading'],
      },
      rollback: {
        mode: 'disable-only',
      },
      auditEvents: ['install', 'enable', 'disable', 'emergency-disable', 'upgrade', 'rollback'],
    },
  },
} as const satisfies CockpitExtensionManifest;

const opsReferenceRouteLoaders = createRouteLoaders(opsReferenceExtension);

const opsReferenceAccessContext = {
  availableCapabilities: opsReferenceCapabilities,
  availableApiScopes: opsReferenceApiScopes,
  availablePrivacyClasses: ['internal', 'restricted'],
  availablePersonas: ['Operator'],
} as const;

const neutralAccessContext = {
  availableCapabilities: ['extension:read', 'extension:inspect'],
  availableApiScopes: ['extensions.read', 'extensions.inspect'],
  availablePrivacyClasses: ['internal', 'restricted'],
  availablePersonas: ['Operator'],
} as const;

function projectWith({
  activePackIds = ['example.reference'],
  accessContext = neutralAccessContext,
  roboticsEnabled = false,
}: {
  activePackIds?: readonly string[];
  accessContext?: CockpitExtensionAccessContext;
  roboticsEnabled?: boolean;
} = {}) {
  const registry = resolveCockpitExtensionRegistry({
    installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
    activePackIds,
    ...neutralAccessContext,
    routeLoaders: neutralRouteLoaders,
  });

  return projectCockpitShellNavigation({
    registry,
    persona: 'Operator',
    accessContext,
    roboticsEnabled,
  });
}

function projectOpsReferenceWith() {
  const registry = resolveCockpitExtensionRegistry({
    installedExtensions: [opsReferenceExtension],
    activePackIds: ['reference.ops'],
    ...opsReferenceAccessContext,
    routeLoaders: opsReferenceRouteLoaders,
  });

  return projectCockpitShellNavigation({
    registry,
    persona: 'Operator',
    accessContext: opsReferenceAccessContext,
    roboticsEnabled: false,
  });
}

function projectExtensionWith({
  manifest,
  accessContext,
  persona = 'Operator',
}: {
  manifest: CockpitExtensionManifest;
  accessContext: CockpitExtensionAccessContext;
  persona?: 'Operator' | 'Approver' | 'Auditor' | 'Admin';
}) {
  const registry = resolveCockpitExtensionRegistry({
    installedExtensions: [manifest],
    activePackIds: ['example.reference'],
    ...neutralAccessContext,
    routeLoaders: createRouteLoaders(manifest),
  });

  return projectCockpitShellNavigation({
    registry,
    persona,
    accessContext,
    roboticsEnabled: false,
  });
}

function flattenLabels(sections: readonly { items?: readonly { label: string }[] }[]): string[] {
  return sections.flatMap((section) => section.items?.map((item) => item.label) ?? []);
}

describe('projectCockpitShellNavigation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('projects core sidebar, mobile, commands, and shortcuts from one shell model', () => {
    const projection = projectWith();

    expect(projection.sidebarSections.map((section) => section.label)).toEqual([
      'Workspace',
      'Work',
      'Reference Extension',
      'Workforce',
      'Config',
      'Explore',
    ]);
    expect(projection.mobilePrimaryItems.map((item) => item.label)).toEqual([
      'Inbox',
      'Approvals',
      'Runs',
      'Dashboard',
      'Reference Overview',
    ]);
    expect(projection.mobileMoreSections.map((section) => section.label)).toEqual([
      'Workspace',
      'Work',
      'Workforce',
      'Config',
      'Explore',
      'Reference Extension',
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toEqual(
      expect.arrayContaining(['Inbox', 'Dashboard', 'Extensions', 'Open extension reference']),
    );
    expect(projection.sidebarSections.map((section) => section.id)).not.toContain('engineering');
    expect(projection.commandTargets.map((target) => target.label)).not.toContain(
      'Mission Control',
    );
    expect(flattenLabels(projection.sidebarSections)).not.toEqual(
      expect.arrayContaining(['Builder', 'Capability Posture', 'Blast Radius', 'Pack Runtime']),
    );
    const extensionTargets = [
      ...projection.sidebarSections.flatMap((section) => section.items ?? []),
      ...projection.mobileMoreSections.flatMap((section) => section.items ?? []),
      ...projection.commandTargets,
    ].filter((item) => item.id.startsWith('extension-'));

    expect(extensionTargets.every((target) => target.to.startsWith('/external/'))).toBe(true);
    expect(extensionTargets.every((target) => !target.to.includes('$'))).toBe(true);
    expect(projectCockpitGChordMap(projection.commandTargets)).toMatchObject({
      i: '/inbox',
      d: '/dashboard',
      x: '/external/example-reference/overview',
    });
  });

  it('can show internal Cockpit surfaces when explicitly enabled', () => {
    vi.stubEnv('VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT', 'true');

    const projection = projectWith();

    expect(projection.sidebarSections.map((section) => section.label)).toContain('Engineering');
    expect(
      projection.sidebarSections
        .find((section) => section.id === 'engineering')
        ?.items?.map((item) => [item.label, item.to]),
    ).toContainEqual(['Mission Control', '/engineering/mission-control']);
    expect(flattenLabels(projection.sidebarSections)).toEqual(
      expect.arrayContaining(['Builder', 'Capability Posture', 'Blast Radius', 'Pack Runtime']),
    );
  });

  it('honors custom shell profile core sections, mobile order, command exclusions, and extension anchor', () => {
    const customProfile = {
      coreSections: [
        {
          id: 'alpha',
          label: 'Alpha',
          items: [
            {
              id: 'alpha-one',
              label: 'Alpha One',
              to: '/alpha/one',
              icon: 'alpha-one',
              shortcut: 'G A',
            },
            {
              id: 'alpha-two',
              label: 'Alpha Two',
              to: '/alpha/two',
              icon: 'alpha-two',
              shortcut: 'G T',
            },
          ],
        },
        {
          id: 'beta',
          label: 'Beta',
          items: [
            {
              id: 'beta-one',
              label: 'Beta One',
              to: '/beta/one',
              icon: 'beta-one',
              shortcut: 'G B',
            },
          ],
        },
        {
          id: 'gamma',
          label: 'Gamma',
          items: [
            {
              id: 'gamma-one',
              label: 'Gamma One',
              to: '/gamma/one',
              icon: 'gamma-one',
              shortcut: 'G G',
            },
          ],
        },
      ],
      mobilePrimaryItemIds: ['beta-one', 'alpha-one'],
      mobileMoreSectionIds: new Set(['gamma', 'alpha']),
      commandExcludedItemIds: new Set(['alpha-two']),
      globalActionExcludedIds: new Set(),
      sidebarExtensionInsertAfterSectionId: 'beta',
    } satisfies CockpitShellProfile;
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [NEUTRAL_REFERENCE_EXTENSION],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: neutralRouteLoaders,
    });

    const projection = projectCockpitShellNavigation({
      registry,
      persona: 'Operator',
      accessContext: neutralAccessContext,
      roboticsEnabled: false,
      shellProfile: customProfile,
    });

    expect(projection.sidebarSections.map((section) => section.label)).toEqual([
      'Alpha',
      'Beta',
      'Reference Extension',
      'Gamma',
    ]);
    expect(projection.mobilePrimaryItems.map((item) => item.label)).toEqual([
      'Beta One',
      'Alpha One',
      'Reference Overview',
    ]);
    expect(projection.mobileMoreSections.map((section) => section.label)).toEqual([
      'Alpha',
      'Gamma',
      'Reference Extension',
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toEqual(
      expect.arrayContaining(['Alpha One', 'Beta One', 'Gamma One', 'Open extension reference']),
    );
    expect(projection.commandTargets.map((target) => target.label)).not.toContain('Alpha Two');
  });

  it('resolves generic extension shell contributions without changing the default profile', () => {
    const profiledReferenceExtension = {
      ...NEUTRAL_REFERENCE_EXTENSION,
      shellContributions: {
        modes: [
          {
            modeId: 'operator',
            priority: 10,
            defaultRoute: { routeId: NEUTRAL_REFERENCE_EXTENSION.routes[0]!.id },
            coreSections: [
              { sectionId: 'explore', order: 0 },
              { sectionId: 'workspace', order: 1 },
              { sectionId: 'engineering', visibility: 'hidden' },
            ],
            coreItems: [{ itemId: 'inbox', visibility: 'hidden' }],
            extensionNav: [
              {
                navItemId: NEUTRAL_REFERENCE_EXTENSION.navItems[0]!.id,
                order: 0,
                mobilePrimary: true,
              },
            ],
            mobilePrimaryCoreItemIds: ['dashboard', 'runs'],
            globalActions: [{ actionId: 'create-run', visibility: 'hidden' }],
            sidebarExtensionInsertAfterSectionId: 'workspace',
          },
        ],
      },
    } satisfies CockpitExtensionManifest;
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [profiledReferenceExtension],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: createRouteLoaders(profiledReferenceExtension),
    });
    const shellProfile = resolveCockpitShellProfile(registry, 'operator');
    const projection = projectCockpitShellNavigation({
      registry,
      persona: 'Operator',
      accessContext: neutralAccessContext,
      roboticsEnabled: false,
      shellProfile,
    });

    expect(shellProfile.defaultRoutePath).toBe('/external/example-reference/overview');
    expect(isCockpitShellGlobalActionVisible(shellProfile, 'create-run')).toBe(false);
    expect(isCockpitShellGlobalActionVisible(shellProfile, 'open-command-palette')).toBe(true);
    expect(projection.sidebarSections.map((section) => section.label)).toEqual([
      'Explore',
      'Workspace',
      'Reference Extension',
      'Work',
      'Workforce',
      'Config',
    ]);
    expect(projection.sidebarSections.flatMap((section) => section.items ?? [])).not.toContainEqual(
      expect.objectContaining({ id: 'inbox' }),
    );
    expect(projection.mobilePrimaryItems.map((item) => item.label)).toContain(
      'Reference Overview',
    );
    expect(projection.mobilePrimaryItems.map((item) => item.label)).toEqual([
      'Dashboard',
      'Runs',
      'Reference Overview',
    ]);
  });

  it('falls back to the default shell profile when a contribution references unknown core ids', () => {
    const invalidReferenceExtension = {
      ...NEUTRAL_REFERENCE_EXTENSION,
      shellContributions: {
        modes: [
          {
            modeId: 'operator',
            coreSections: [{ sectionId: 'not-a-core-section', order: 0 }],
          },
        ],
      },
    } satisfies CockpitExtensionManifest;
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [invalidReferenceExtension],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: createRouteLoaders(invalidReferenceExtension),
    });

    expect(resolveCockpitShellProfile(registry, 'operator')).toBe(PORTARIUM_COCKPIT_SHELL_PROFILE);
  });

  it('falls back to the default shell profile when contributed routes are not accessible', () => {
    const profiledReferenceExtension = {
      ...NEUTRAL_REFERENCE_EXTENSION,
      shellContributions: {
        modes: [
          {
            modeId: 'operator',
            defaultRoute: { routeId: NEUTRAL_REFERENCE_EXTENSION.routes[0]!.id },
            mobilePrimaryCoreItemIds: [],
            extensionNav: [
              {
                navItemId: NEUTRAL_REFERENCE_EXTENSION.navItems[0]!.id,
                order: 0,
                mobilePrimary: true,
              },
            ],
          },
        ],
      },
    } satisfies CockpitExtensionManifest;
    const registry = resolveCockpitExtensionRegistry({
      installedExtensions: [profiledReferenceExtension],
      activePackIds: ['example.reference'],
      ...neutralAccessContext,
      routeLoaders: createRouteLoaders(profiledReferenceExtension),
    });

    expect(
      resolveCockpitShellProfile(registry, 'operator', undefined, {
        persona: 'Operator',
        accessContext: {
          ...neutralAccessContext,
          availablePrivacyClasses: [],
        },
      }),
    ).toBe(PORTARIUM_COCKPIT_SHELL_PROFILE);
  });

  it('hides extension projections while keeping core shell entries when activation is absent', () => {
    const projection = projectWith({ activePackIds: [] });

    expect(projection.sidebarSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.mobileMoreSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.commandTargets.map((target) => target.label)).not.toContain(
      'Open extension reference',
    );
    expect(projection.sidebarSections[0]?.items?.map((item) => item.label)).toEqual([
      'Inbox',
      'Dashboard',
      'Projects',
      'Work Items',
    ]);
  });

  it('places an ops extension near work with a discoverable section label', () => {
    const projection = projectOpsReferenceWith();
    const sidebarLabels = projection.sidebarSections.map((section) => section.label);

    expect(sidebarLabels).toEqual([
      'Workspace',
      'Work',
      'Ops Reference',
      'Workforce',
      'Config',
      'Explore',
    ]);
    expect(sidebarLabels.indexOf('Ops Reference')).toBeLessThan(
      sidebarLabels.indexOf('Workforce'),
    );
    expect(
      projection.sidebarSections
        .find((section) => section.id === 'extension:reference.ops:sidebar')
        ?.items?.map((item) => [item.label, item.to]),
    ).toEqual([
      ['Ticket Queue', '/external/ops-reference/tickets'],
      ['Campus Map', '/external/ops-reference/map'],
      ['Data Sources', '/external/ops-reference'],
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toContain(
      'Open ops queue',
    );
  });

  it('projects neutral extension navigation with stable shell ids and match paths', () => {
    const projection = projectWith();
    const sidebarExtensionItems =
      projection.sidebarSections.find(
        (section) => section.id === 'extension:example.reference:sidebar',
      )?.items ?? [];
    const mobileExtensionItems =
      projection.mobileMoreSections.find(
        (section) => section.id === 'extension:example.reference:mobile-more',
      )?.items ?? [];

    expect(sidebarExtensionItems).toMatchObject([
      {
        id: 'extension-nav:example-reference-overview-nav',
        label: 'Reference Overview',
        to: '/external/example-reference/overview',
        matchPath: '/external/example-reference/overview',
      },
    ]);
    expect(mobileExtensionItems).toMatchObject([
      {
        id: 'extension-mobile:example-reference-overview-nav',
        label: 'Reference Overview',
        to: '/external/example-reference/overview',
        matchPath: '/external/example-reference/overview',
      },
    ]);
    expect(projection.mobilePrimaryItems).toContainEqual(
      expect.objectContaining({
        id: 'extension-primary:example-reference-overview-nav',
        label: 'Reference Overview',
        to: '/external/example-reference/overview',
      }),
    );
  });

  it('hides extension items from every projected surface when the route guard denies access', () => {
    const projection = projectWith({
      accessContext: {
        ...neutralAccessContext,
        availablePrivacyClasses: [],
      },
    });

    expect(projection.sidebarSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.mobileMoreSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.commandTargets.map((target) => target.label)).not.toContain(
      'Open extension reference',
    );
    expect(projectCockpitGChordMap(projection.commandTargets).x).toBeUndefined();
  });

  it('hides extension navigation when the nav item is stricter than its route guard', () => {
    const stricterNavExtension = {
      ...NEUTRAL_REFERENCE_EXTENSION,
      navItems: [
        {
          ...NEUTRAL_REFERENCE_EXTENSION.navItems[0]!,
          personas: ['Approver'],
          requiredCapabilities: ['extension:inspect'],
          requiredApiScopes: ['extensions.inspect'],
        },
      ],
    } satisfies CockpitExtensionManifest;
    const projection = projectExtensionWith({
      manifest: stricterNavExtension,
      accessContext: {
        ...neutralAccessContext,
        availableCapabilities: ['extension:read'],
        availableApiScopes: ['extensions.read'],
      },
    });

    expect(projection.sidebarSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.mobileMoreSections.map((section) => section.label)).not.toContain(
      'Reference Extension',
    );
    expect(projection.mobilePrimaryItems.map((item) => item.label)).not.toContain(
      'Reference Overview',
    );
  });

  it('filters robotics entries through the same projected shell model', () => {
    expect(projectWith().sidebarSections.map((section) => section.label)).not.toContain('Robotics');
    expect(
      projectWith({ roboticsEnabled: true }).sidebarSections.map((section) => section.label),
    ).toContain('Robotics');
  });

  it('projects pending approval badges consistently onto Inbox and Approvals surfaces', () => {
    const projection = projectCockpitShellNavigation({
      registry: resolveCockpitExtensionRegistry({
        installedExtensions: [],
        activePackIds: [],
        ...neutralAccessContext,
        routeLoaders: {},
      }),
      persona: 'Operator',
      accessContext: neutralAccessContext,
      roboticsEnabled: false,
      liveState: { pendingApprovalCount: 3 },
    });

    const sidebarItems = projection.sidebarSections.flatMap((section) => section.items ?? []);
    expect(sidebarItems.find((item) => item.id === 'inbox')?.badge).toMatchObject({
      value: 3,
      label: '3 pending',
      ariaLabel: '3 pending approvals',
    });
    expect(sidebarItems.find((item) => item.id === 'approvals')?.badge).toMatchObject({
      value: 3,
      label: '3 pending',
      ariaLabel: '3 pending approvals',
    });
    expect(projection.mobilePrimaryItems.find((item) => item.id === 'inbox')?.badge?.value).toBe(3);
    expect(
      projection.mobilePrimaryItems.find((item) => item.id === 'approvals')?.badge?.value,
    ).toBe(3);
  });

  it('omits live badges when there are no pending approvals', () => {
    const projection = projectWith();
    const sidebarItems = projection.sidebarSections.flatMap((section) => section.items ?? []);

    expect(sidebarItems.find((item) => item.id === 'inbox')?.badge).toBeUndefined();
    expect(sidebarItems.find((item) => item.id === 'approvals')?.badge).toBeUndefined();
  });
});
