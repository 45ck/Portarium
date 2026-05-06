import { describe, expect, it } from 'vitest';
import { NEUTRAL_REFERENCE_EXTENSION } from '@/lib/extensions/fixtures';
import { resolveCockpitExtensionRegistry } from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  CockpitExtensionManifest,
  CockpitExtensionRouteModuleLoader,
} from '@/lib/extensions/types';
import {
  PORTARIUM_COCKPIT_SHELL_PROFILE,
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
const schoolOpsCapabilities = [
  'school-ops.ticket.read',
  'school-ops.map.read',
  'school-ops.source.read',
] as const;
const schoolOpsApiScopes = ['school-ops.read'] as const;
const schoolOpsReferenceExtension = {
  manifestVersion: 1,
  id: 'reference.school-ops',
  owner: 'school-ops-provider',
  version: '0.1.0',
  displayName: 'School Ops Reference',
  description:
    'Read-only school operations workspace for ticket triage, campus context, and source evidence.',
  packIds: ['reference.school-ops'],
  personas: allPersonas,
  requiredCapabilities: schoolOpsCapabilities,
  requiredApiScopes: schoolOpsApiScopes,
  routes: [
    {
      id: 'school-ops-reference-tickets',
      path: '/external/school-ops-reference/tickets',
      title: 'Ticket Queue',
      description: 'Read-only ticket queue for school operations triage.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['school-ops.ticket.read'],
        requiredApiScopes: schoolOpsApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['school-ops.tickets.read'],
    },
    {
      id: 'school-ops-reference-campus-map',
      path: '/external/school-ops-reference/map',
      title: 'Campus Map',
      description: 'Read-only campus map context for school operations.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['school-ops.map.read'],
        requiredApiScopes: schoolOpsApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['school-ops.map.read'],
    },
    {
      id: 'school-ops-reference-data-sources',
      path: '/external/school-ops-reference',
      title: 'Data Sources',
      description: 'Read-only source catalogue for school operations evidence.',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['school-ops.source.read'],
        requiredApiScopes: schoolOpsApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['school-ops.sources.read'],
    },
  ],
  navItems: [
    {
      id: 'school-ops-reference-tickets-nav',
      title: 'Ticket Queue',
      routeId: 'school-ops-reference-tickets',
      to: '/external/school-ops-reference/tickets',
      icon: 'clipboard-check',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['school-ops.ticket.read'],
      requiredApiScopes: schoolOpsApiScopes,
      mobilePrimary: true,
    },
    {
      id: 'school-ops-reference-campus-map-nav',
      title: 'Campus Map',
      routeId: 'school-ops-reference-campus-map',
      to: '/external/school-ops-reference/map',
      icon: 'map',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['school-ops.map.read'],
      requiredApiScopes: schoolOpsApiScopes,
    },
    {
      id: 'school-ops-reference-data-sources-nav',
      title: 'Data Sources',
      routeId: 'school-ops-reference-data-sources',
      to: '/external/school-ops-reference',
      icon: 'boxes',
      surfaces: ['sidebar', 'mobile-more', 'command'],
      personas: allPersonas,
      requiredCapabilities: ['school-ops.source.read'],
      requiredApiScopes: schoolOpsApiScopes,
    },
  ],
  commands: [
    {
      id: 'school-ops-reference-open-tickets',
      title: 'Open school ops queue',
      routeId: 'school-ops-reference-tickets',
      guard: {
        personas: allPersonas,
        requiredCapabilities: ['school-ops.ticket.read'],
        requiredApiScopes: schoolOpsApiScopes,
        privacyClasses: ['internal', 'restricted'],
      },
      permissionGrantIds: ['school-ops.tickets.read'],
      requiredCapabilities: ['school-ops.ticket.read'],
      requiredApiScopes: schoolOpsApiScopes,
      shortcut: 'G T',
    },
  ],
  governance: {
    identity: {
      publisher: 'school-ops-provider',
      attestation: {
        kind: 'source-review',
        subject: 'packages/school-ops-portarium-extension/src',
        digestSha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        issuedAtIso: '2026-05-04T00:00:00.000Z',
      },
    },
    versionPin: {
      packageName: '@school-ops/portarium-extension',
      version: '0.1.0',
      sourceRef: 'packages/school-ops-portarium-extension',
    },
    permissions: [
      {
        id: 'school-ops.tickets.read',
        kind: 'data-query',
        title: 'Read school operations tickets',
        requiredCapabilities: ['school-ops.ticket.read'],
        requiredApiScopes: schoolOpsApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.school-ops.tickets.read'],
      },
      {
        id: 'school-ops.map.read',
        kind: 'data-query',
        title: 'Read school operations map context',
        requiredCapabilities: ['school-ops.map.read'],
        requiredApiScopes: schoolOpsApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.school-ops.map.read'],
      },
      {
        id: 'school-ops.sources.read',
        kind: 'data-query',
        title: 'Read school operations source catalogue',
        requiredCapabilities: ['school-ops.source.read'],
        requiredApiScopes: schoolOpsApiScopes,
        policySemantics: 'authorization-required',
        evidenceSemantics: 'read-audited-by-control-plane',
        auditEventTypes: ['cockpit.extension.school-ops.sources.read'],
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

const schoolOpsReferenceRouteLoaders = createRouteLoaders(schoolOpsReferenceExtension);

const schoolOpsReferenceAccessContext = {
  availableCapabilities: schoolOpsCapabilities,
  availableApiScopes: schoolOpsApiScopes,
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

function projectSchoolOpsWith() {
  const registry = resolveCockpitExtensionRegistry({
    installedExtensions: [schoolOpsReferenceExtension],
    activePackIds: ['reference.school-ops'],
    ...schoolOpsReferenceAccessContext,
    routeLoaders: schoolOpsReferenceRouteLoaders,
  });

  return projectCockpitShellNavigation({
    registry,
    persona: 'Operator',
    accessContext: schoolOpsReferenceAccessContext,
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

describe('projectCockpitShellNavigation', () => {
  it('projects core sidebar, mobile, commands, and shortcuts from one shell model', () => {
    const projection = projectWith();

    expect(projection.sidebarSections.map((section) => section.label)).toEqual([
      'Workspace',
      'Work',
      'Reference Extension',
      'Engineering',
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
      'Engineering',
      'Workforce',
      'Config',
      'Explore',
      'Reference Extension',
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toEqual(
      expect.arrayContaining(['Inbox', 'Dashboard', 'Extensions', 'Open extension reference']),
    );
    expect(
      projection.sidebarSections
        .find((section) => section.id === 'engineering')
        ?.items?.map((item) => [item.label, item.to]),
    ).toContainEqual(['Mission Control', '/engineering/mission-control']);
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

  it('places a school ops extension near work with a discoverable section label', () => {
    const projection = projectSchoolOpsWith();
    const sidebarLabels = projection.sidebarSections.map((section) => section.label);

    expect(sidebarLabels).toEqual([
      'Workspace',
      'Work',
      'School Ops Reference',
      'Engineering',
      'Workforce',
      'Config',
      'Explore',
    ]);
    expect(sidebarLabels.indexOf('School Ops Reference')).toBeLessThan(
      sidebarLabels.indexOf('Engineering'),
    );
    expect(
      projection.sidebarSections
        .find((section) => section.id === 'extension:reference.school-ops:sidebar')
        ?.items?.map((item) => [item.label, item.to]),
    ).toEqual([
      ['Ticket Queue', '/external/school-ops-reference/tickets'],
      ['Campus Map', '/external/school-ops-reference/map'],
      ['Data Sources', '/external/school-ops-reference'],
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toContain(
      'Open school ops queue',
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
