import { describe, expect, it } from 'vitest';
import { NEUTRAL_REFERENCE_EXTENSION } from '@/lib/extensions/fixtures';
import { resolveCockpitExtensionRegistry } from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  CockpitExtensionRouteModuleLoader,
} from '@/lib/extensions/types';
import { projectCockpitGChordMap, projectCockpitShellNavigation } from '@/lib/shell/navigation';

const neutralRouteLoaders = Object.fromEntries(
  NEUTRAL_REFERENCE_EXTENSION.routes.map((route) => [
    route.id,
    (() => Promise.resolve({})) satisfies CockpitExtensionRouteModuleLoader,
  ]),
);

const neutralAccessContext = {
  availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
  availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
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

describe('projectCockpitShellNavigation', () => {
  it('projects core sidebar, mobile, commands, and shortcuts from one shell model', () => {
    const projection = projectWith();

    expect(projection.sidebarSections.map((section) => section.label)).toEqual([
      'Workspace',
      'Work',
      'Engineering',
      'Workforce',
      'Config',
      'Explore',
      'Extensions',
    ]);
    expect(projection.mobilePrimaryItems.map((item) => item.label)).toEqual([
      'Inbox',
      'Approvals',
      'Runs',
      'Dashboard',
    ]);
    expect(projection.mobileMoreSections.map((section) => section.label)).toEqual([
      'Workspace',
      'Work',
      'Workforce',
      'Config',
      'Explore',
      'Extensions',
    ]);
    expect(projection.commandTargets.map((target) => target.label)).toEqual(
      expect.arrayContaining(['Inbox', 'Dashboard', 'Extensions', 'Open reference extension']),
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

  it('hides extension projections while keeping core shell entries when activation is absent', () => {
    const projection = projectWith({ activePackIds: [] });

    expect(projection.sidebarSections.map((section) => section.label)).not.toContain('Extensions');
    expect(projection.mobileMoreSections.map((section) => section.label)).not.toContain(
      'Extensions',
    );
    expect(projection.commandTargets.map((target) => target.label)).not.toContain(
      'Open reference extension',
    );
    expect(projection.sidebarSections[0]?.items?.map((item) => item.label)).toEqual([
      'Inbox',
      'Dashboard',
      'Work Items',
    ]);
  });

  it('hides extension items from every projected surface when the route guard denies access', () => {
    const projection = projectWith({
      accessContext: {
        ...neutralAccessContext,
        availablePrivacyClasses: [],
      },
    });

    expect(projection.sidebarSections.map((section) => section.label)).not.toContain('Extensions');
    expect(projection.mobileMoreSections.map((section) => section.label)).not.toContain(
      'Extensions',
    );
    expect(projection.commandTargets.map((target) => target.label)).not.toContain(
      'Open reference extension',
    );
    expect(projectCockpitGChordMap(projection.commandTargets).x).toBeUndefined();
  });

  it('filters robotics entries through the same projected shell model', () => {
    expect(projectWith().sidebarSections.map((section) => section.label)).not.toContain('Robotics');
    expect(
      projectWith({ roboticsEnabled: true }).sidebarSections.map((section) => section.label),
    ).toContain('Robotics');
  });
});
