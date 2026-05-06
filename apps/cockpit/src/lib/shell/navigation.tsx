import type { ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ExternalLink,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Map as MapIcon,
  Plug,
  Route as RouteIcon,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Users,
} from 'lucide-react';
import { EntityIcon } from '@/components/domain/entity-icon';
import {
  canAccessExtensionNavItem,
  canAccessExtensionRoute,
  selectExtensionCommands,
} from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  CockpitExtensionIcon,
  CockpitShellModeContribution,
  CockpitExtensionNavItem,
  ResolvedCockpitExtensionRegistry,
} from '@/lib/extensions/types';
import type { PersonaId } from '@/stores/ui-store';

export interface CockpitShellNavigationItem {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  badge?: CockpitShellNavigationBadge;
  comingSoon?: boolean;
  shortcut?: string;
  matchPath?: string;
}

export interface CockpitShellNavigationBadge {
  value: number;
  label: string;
  ariaLabel: string;
}

export interface CockpitShellNavigationSection {
  id: string;
  label: string;
  items?: readonly CockpitShellNavigationItem[];
  comingSoon?: boolean;
}

export interface CockpitShellCommandTarget {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  shortcut?: string;
}

export interface CockpitShellProjection {
  sidebarSections: readonly CockpitShellNavigationSection[];
  mobilePrimaryItems: readonly CockpitShellNavigationItem[];
  mobileMoreSections: readonly CockpitShellNavigationSection[];
  commandTargets: readonly CockpitShellCommandTarget[];
}

export interface CockpitShellProfile {
  coreSections: readonly CockpitShellNavigationSection[];
  mobilePrimaryItemIds: readonly string[];
  mobileMoreSectionIds: ReadonlySet<string>;
  commandExcludedItemIds: ReadonlySet<string>;
  globalActionExcludedIds: ReadonlySet<string>;
  sidebarExtensionInsertAfterSectionId: string;
  extensionNavItemIds?: readonly string[];
  extensionMobilePrimaryNavItemIds?: readonly string[];
  defaultRoutePath?: string;
}

export interface ResolveCockpitShellProfileOptions {
  persona?: PersonaId;
  accessContext?: CockpitExtensionAccessContext;
}

export interface ProjectCockpitShellNavigationInput {
  registry: ResolvedCockpitExtensionRegistry;
  persona: PersonaId;
  accessContext: CockpitExtensionAccessContext;
  roboticsEnabled: boolean;
  liveState?: CockpitShellLiveState;
  shellProfile?: CockpitShellProfile;
}

export interface CockpitShellLiveState {
  pendingApprovalCount?: number;
}

const CORE_SHELL_SECTIONS: readonly CockpitShellNavigationSection[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        id: 'inbox',
        label: 'Inbox',
        to: '/inbox',
        icon: <Inbox className="h-4 w-4" />,
        shortcut: 'G I',
        matchPath: '/inbox',
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        to: '/dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        shortcut: 'G D',
        matchPath: '/dashboard',
      },
      {
        id: 'projects',
        label: 'Projects',
        to: '/projects',
        icon: <EntityIcon entityType="project" size="sm" decorative />,
        shortcut: 'G P',
        matchPath: '/projects',
      },
      {
        id: 'work-items',
        label: 'Work Items',
        to: '/work-items',
        icon: <EntityIcon entityType="work-item" size="sm" decorative />,
        shortcut: 'G W',
        matchPath: '/work-items',
      },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      {
        id: 'runs',
        label: 'Runs',
        to: '/runs',
        icon: <EntityIcon entityType="run" size="sm" decorative />,
        shortcut: 'G R',
        matchPath: '/runs',
      },
      {
        id: 'workflows',
        label: 'Workflows',
        to: '/workflows',
        icon: <EntityIcon entityType="workflow" size="sm" decorative />,
        matchPath: '/workflows',
      },
      {
        id: 'workflow-builder',
        label: 'Builder',
        to: '/workflows/builder',
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        id: 'approvals',
        label: 'Approvals',
        to: '/approvals',
        icon: <EntityIcon entityType="approval" size="sm" decorative />,
        shortcut: 'G A',
        matchPath: '/approvals',
      },
      {
        id: 'evidence',
        label: 'Evidence',
        to: '/evidence',
        icon: <EntityIcon entityType="evidence" size="sm" decorative />,
        shortcut: 'G E',
        matchPath: '/evidence',
      },
      {
        id: 'search',
        label: 'Search',
        to: '/search',
        icon: <Search className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    items: [
      {
        id: 'engineering-beads',
        label: 'Beads',
        to: '/engineering/beads',
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        id: 'engineering-mission-control',
        label: 'Mission Control',
        to: '/engineering/mission-control',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        id: 'engineering-autonomy',
        label: 'Autonomy',
        to: '/engineering/autonomy',
        icon: <Sliders className="h-4 w-4" />,
        comingSoon: true,
      },
    ],
  },
  {
    id: 'workforce',
    label: 'Workforce',
    items: [
      {
        id: 'workforce-members',
        label: 'Members',
        to: '/workforce',
        icon: <EntityIcon entityType="workforce" size="sm" decorative />,
      },
      {
        id: 'workforce-queues',
        label: 'Queues',
        to: '/workforce/queues',
        icon: <EntityIcon entityType="queue" size="sm" decorative />,
      },
      {
        id: 'workforce-coverage',
        label: 'Coverage',
        to: '/workforce/coverage',
        icon: <ShieldCheck className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'config',
    label: 'Config',
    items: [
      {
        id: 'config-machines',
        label: 'Machines',
        to: '/config/machines',
        icon: <EntityIcon entityType="machine" size="sm" decorative />,
      },
      {
        id: 'config-agents',
        label: 'Agents',
        to: '/config/agents',
        icon: <EntityIcon entityType="agent" size="sm" decorative />,
      },
      {
        id: 'config-adapters',
        label: 'Adapters',
        to: '/config/adapters',
        icon: <EntityIcon entityType="adapter" size="sm" decorative />,
      },
      {
        id: 'config-credentials',
        label: 'Credentials',
        to: '/config/credentials',
        icon: <EntityIcon entityType="credential" size="sm" decorative />,
      },
      {
        id: 'config-policies',
        label: 'Policies',
        to: '/config/policies',
        icon: <EntityIcon entityType="policy" size="sm" decorative />,
      },
      {
        id: 'config-capability-posture',
        label: 'Capability Posture',
        to: '/config/capability-posture',
        icon: <Sliders className="h-4 w-4" />,
      },
      {
        id: 'config-blast-radius',
        label: 'Blast Radius',
        to: '/config/blast-radius',
        icon: <ShieldAlert className="h-4 w-4" />,
      },
      {
        id: 'config-users',
        label: 'Users',
        to: '/config/users',
        icon: <Users className="h-4 w-4" />,
      },
      {
        id: 'config-settings',
        label: 'Settings',
        to: '/config/settings',
        icon: <Settings className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      {
        id: 'explore-objects',
        label: 'Objects',
        to: '/explore/objects',
        icon: <EntityIcon entityType="external-object-ref" size="sm" decorative />,
      },
      {
        id: 'explore-events',
        label: 'Events',
        to: '/explore/events',
        icon: <EntityIcon entityType="event" size="sm" decorative />,
      },
      {
        id: 'explore-observability',
        label: 'Observability',
        to: '/explore/observability',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        id: 'explore-governance',
        label: 'Governance',
        to: '/explore/governance',
        icon: <Scale className="h-4 w-4" />,
      },
      {
        id: 'explore-pack-runtime',
        label: 'Pack Runtime',
        to: '/explore/pack-runtime',
        icon: <Settings className="h-4 w-4" />,
      },
      {
        id: 'explore-extensions',
        label: 'Extensions',
        to: '/explore/extensions',
        icon: <Plug className="h-4 w-4" />,
      },
    ],
  },
  {
    id: 'robotics',
    label: 'Robotics',
    items: [
      {
        id: 'robotics-map',
        label: 'Map',
        to: '/robotics/map',
        icon: <MapIcon className="h-4 w-4" />,
      },
      {
        id: 'robotics-robots',
        label: 'Robots',
        to: '/robotics/robots',
        icon: <EntityIcon entityType="robot" size="sm" decorative />,
      },
      {
        id: 'robotics-missions',
        label: 'Missions',
        to: '/robotics/missions',
        icon: <EntityIcon entityType="mission" size="sm" decorative />,
      },
      {
        id: 'robotics-safety',
        label: 'Safety',
        to: '/robotics/safety',
        icon: <ShieldAlert className="h-4 w-4" />,
      },
      {
        id: 'robotics-gateways',
        label: 'Gateways',
        to: '/robotics/gateways',
        icon: <EntityIcon entityType="port" size="sm" decorative />,
      },
    ],
  },
];

const MOBILE_PRIMARY_ITEM_IDS = ['inbox', 'approvals', 'runs', 'dashboard'] as const;
const MOBILE_MORE_SECTION_IDS = new Set([
  'workspace',
  'work',
  'workforce',
  'config',
  'explore',
]);
const COMMAND_EXCLUDED_ITEM_IDS = new Set([
  'search',
  'workflow-builder',
  'engineering-beads',
  'engineering-mission-control',
  'engineering-autonomy',
  'config-blast-radius',
  'config-policies',
  'config-users',
  'explore-pack-runtime',
]);
const SIDEBAR_EXTENSION_INSERT_AFTER_SECTION_ID = 'work';
const DEFAULT_HIDDEN_SECTION_IDS = new Set(['engineering']);
const DEFAULT_HIDDEN_ITEM_IDS = new Set([
  'workflow-builder',
  'config-capability-posture',
  'config-blast-radius',
  'explore-pack-runtime',
]);

export const PORTARIUM_COCKPIT_SHELL_PROFILE: CockpitShellProfile = {
  coreSections: CORE_SHELL_SECTIONS,
  mobilePrimaryItemIds: MOBILE_PRIMARY_ITEM_IDS,
  mobileMoreSectionIds: MOBILE_MORE_SECTION_IDS,
  commandExcludedItemIds: COMMAND_EXCLUDED_ITEM_IDS,
  globalActionExcludedIds: new Set(),
  sidebarExtensionInsertAfterSectionId: SIDEBAR_EXTENSION_INSERT_AFTER_SECTION_ID,
};

export function resolveCockpitShellProfile(
  registry: ResolvedCockpitExtensionRegistry,
  modeId?: string,
  baseProfile: CockpitShellProfile = PORTARIUM_COCKPIT_SHELL_PROFILE,
  options: ResolveCockpitShellProfileOptions = {},
): CockpitShellProfile {
  const normalizedModeId = modeId?.trim();
  if (!normalizedModeId) return baseProfile;

  const contribution = registry.extensions
    .filter((extension) => extension.status === 'enabled')
    .flatMap((extension) => extension.manifest.shellContributions?.modes ?? [])
    .filter((mode) => mode.modeId === normalizedModeId)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .at(0);

  if (
    !contribution ||
    !isValidShellContribution(contribution, registry, baseProfile) ||
    !canAccessShellContribution(contribution, registry, options)
  ) {
    return baseProfile;
  }

  const defaultRoutePath = contribution.defaultRoute
    ? registry.routes.find((route) => route.id === contribution.defaultRoute?.routeId)?.path
    : undefined;

  return {
    ...baseProfile,
    coreSections: projectProfileCoreSections(baseProfile.coreSections, contribution),
    mobilePrimaryItemIds:
      contribution.mobilePrimaryCoreItemIds ?? baseProfile.mobilePrimaryItemIds,
    globalActionExcludedIds: projectGlobalActionExclusions(
      baseProfile.globalActionExcludedIds,
      contribution,
    ),
    sidebarExtensionInsertAfterSectionId:
      contribution.sidebarExtensionInsertAfterSectionId ??
      baseProfile.sidebarExtensionInsertAfterSectionId,
    extensionNavItemIds: contribution.extensionNav?.map((item) => item.navItemId),
    extensionMobilePrimaryNavItemIds: contribution.extensionNav
      ?.filter((item) => item.mobilePrimary)
      .map((item) => item.navItemId),
    defaultRoutePath,
  };
}

export function projectCockpitShellNavigation({
  registry,
  persona,
  accessContext,
  roboticsEnabled,
  liveState,
  shellProfile = PORTARIUM_COCKPIT_SHELL_PROFILE,
}: ProjectCockpitShellNavigationInput): CockpitShellProjection {
  const shellSections = shouldShowInternalCockpitSurfaces()
    ? shellProfile.coreSections
    : hideDefaultInternalCockpitSurfaces(shellProfile.coreSections);
  const coreSections = projectCoreNavigationSections(
    roboticsEnabled ? shellSections : shellSections.filter((section) => section.id !== 'robotics'),
    liveState,
  );
  const extensionSidebarSections = projectExtensionNavigationSections(
    registry,
    'sidebar',
    'extension-nav',
    persona,
    accessContext,
    shellProfile,
  );
  const extensionMobileMoreSections = projectExtensionNavigationSections(
    registry,
    'mobile-more',
    'extension-mobile',
    persona,
    accessContext,
    shellProfile,
  );
  const extensionMobilePrimaryItems = projectExtensionMobilePrimaryItems(
    registry,
    persona,
    accessContext,
    shellProfile,
  );
  const extensionCommandTargets = selectExtensionCommands(registry, persona, accessContext).reduce<
    CockpitShellCommandTarget[]
  >((targets, command) => {
    const route = command.routeId
      ? registry.routes.find((candidate) => candidate.id === command.routeId)
      : undefined;
    if (!route || route.path.includes('$')) return targets;

    targets.push({
      id: `extension-command:${command.id}`,
      label: command.title,
      to: route.path,
      icon: <Plug className="h-4 w-4" />,
      shortcut: command.shortcut,
    });
    return targets;
  }, []);

  const sidebarSections = insertSidebarExtensionSections(
    coreSections,
    extensionSidebarSections,
    shellProfile.sidebarExtensionInsertAfterSectionId,
  );
  const mobileMoreBaseSections = coreSections.filter((section) =>
    shellProfile.mobileMoreSectionIds.has(section.id),
  );
  const mobileMoreSections =
    extensionMobileMoreSections.length > 0
      ? [...mobileMoreBaseSections, ...extensionMobileMoreSections]
      : mobileMoreBaseSections;

  return {
    sidebarSections,
    mobilePrimaryItems: [
      ...projectMobilePrimaryItems(coreSections, shellProfile.mobilePrimaryItemIds),
      ...extensionMobilePrimaryItems,
    ],
    mobileMoreSections,
    commandTargets: [
      ...flattenItems(coreSections)
        .filter((item) => !item.comingSoon && !shellProfile.commandExcludedItemIds.has(item.id))
        .map(
          (item): CockpitShellCommandTarget => ({
            id: `core-command:${item.id}`,
            label: item.label,
            to: item.to,
            icon: item.icon,
            shortcut: item.shortcut,
          }),
        ),
      ...extensionCommandTargets,
    ],
  };
}

export function shouldShowInternalCockpitSurfaces(): boolean {
  return import.meta.env.VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT === 'true';
}

export function projectCockpitGChordMap(
  commandTargets: readonly CockpitShellCommandTarget[],
): Record<string, string> {
  return commandTargets.reduce<Record<string, string>>((shortcuts, target) => {
    const match = target.shortcut?.match(/^G\s+([a-z])$/i);
    if (!match?.[1]) return shortcuts;

    const key = match[1].toLowerCase();
    if (!shortcuts[key]) {
      shortcuts[key] = target.to;
    }
    return shortcuts;
  }, {});
}

export function isCockpitShellGlobalActionVisible(
  shellProfile: CockpitShellProfile,
  actionId: string,
): boolean {
  return !shellProfile.globalActionExcludedIds.has(actionId);
}

export function isCockpitShellCoreItemVisible(
  shellProfile: CockpitShellProfile,
  itemId: string,
): boolean {
  return shellProfile.coreSections.some((section) =>
    (section.items ?? []).some((item) => item.id === itemId),
  );
}

function isConcretePathItem(item: { to: string }): boolean {
  return !item.to.includes('$');
}

function projectExtensionNavigationSections(
  registry: ResolvedCockpitExtensionRegistry,
  surface: 'sidebar' | 'mobile-more',
  idPrefix: string,
  persona: PersonaId,
  accessContext: CockpitExtensionAccessContext,
  shellProfile: CockpitShellProfile,
): readonly CockpitShellNavigationSection[] {
  return registry.extensions.flatMap((extension) => {
    if (extension.status !== 'enabled') return [];

    const items = extension.manifest.navItems
      .filter((item) => item.surfaces.includes(surface))
      .filter(isConcretePathItem)
      .filter(
        (item) => canAccessExtensionNavItem(item, registry, { ...accessContext, persona }).allowed,
      )
      .sort((a, b) => compareExtensionNavItems(a, b, shellProfile))
      .map((item) => projectExtensionNavigationItem(item, idPrefix));

    return items.length > 0
      ? [
          {
            id: `extension:${extension.manifest.id}:${surface}`,
            label: extension.manifest.displayName,
            items,
          },
        ]
      : [];
  });
}

function projectExtensionMobilePrimaryItems(
  registry: ResolvedCockpitExtensionRegistry,
  persona: PersonaId,
  accessContext: CockpitExtensionAccessContext,
  shellProfile: CockpitShellProfile,
): readonly CockpitShellNavigationItem[] {
  const profileMobilePrimaryIds = new Set(shellProfile.extensionMobilePrimaryNavItemIds ?? []);

  return registry.extensions.flatMap((extension) => {
    if (extension.status !== 'enabled') return [];

    return extension.manifest.navItems
      .filter((item) => item.mobilePrimary || profileMobilePrimaryIds.has(item.id))
      .filter(isConcretePathItem)
      .filter(
        (item) => canAccessExtensionNavItem(item, registry, { ...accessContext, persona }).allowed,
      )
      .sort((a, b) => compareExtensionMobilePrimaryItems(a, b, shellProfile))
      .map((item) => projectExtensionNavigationItem(item, 'extension-primary'));
  });
}

function compareExtensionNavItems(
  a: CockpitExtensionNavItem,
  b: CockpitExtensionNavItem,
  shellProfile: CockpitShellProfile,
): number {
  return (
    readProfileOrder(shellProfile.extensionNavItemIds, a.id) -
    readProfileOrder(shellProfile.extensionNavItemIds, b.id)
  );
}

function compareExtensionMobilePrimaryItems(
  a: CockpitExtensionNavItem,
  b: CockpitExtensionNavItem,
  shellProfile: CockpitShellProfile,
): number {
  return (
    readProfileOrder(shellProfile.extensionMobilePrimaryNavItemIds, a.id) -
    readProfileOrder(shellProfile.extensionMobilePrimaryNavItemIds, b.id)
  );
}

function readProfileOrder(ids: readonly string[] | undefined, id: string): number {
  const index = ids?.indexOf(id) ?? -1;
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function projectExtensionNavigationItem(
  item: CockpitExtensionNavItem,
  idPrefix: string,
): CockpitShellNavigationItem {
  return {
    id: `${idPrefix}:${item.id}`,
    label: item.title,
    to: item.to,
    icon: extensionIcon(item.icon),
    matchPath: item.to,
  };
}

function flattenItems(
  sections: readonly CockpitShellNavigationSection[],
): readonly CockpitShellNavigationItem[] {
  return sections.flatMap((section) => section.items ?? []);
}

function insertSidebarExtensionSections(
  coreSections: readonly CockpitShellNavigationSection[],
  extensionSections: readonly CockpitShellNavigationSection[],
  insertAfterSectionId: string,
): readonly CockpitShellNavigationSection[] {
  if (extensionSections.length === 0) return coreSections;

  const insertAfterIndex = coreSections.findIndex((section) => section.id === insertAfterSectionId);
  if (insertAfterIndex < 0) return [...coreSections, ...extensionSections];

  return [
    ...coreSections.slice(0, insertAfterIndex + 1),
    ...extensionSections,
    ...coreSections.slice(insertAfterIndex + 1),
  ];
}

function projectMobilePrimaryItems(
  sections: readonly CockpitShellNavigationSection[],
  mobilePrimaryItemIds: readonly string[],
): readonly CockpitShellNavigationItem[] {
  const itemsById = new Map(flattenItems(sections).map((item) => [item.id, item]));
  return mobilePrimaryItemIds.flatMap((itemId) => {
    const item = itemsById.get(itemId);
    return item ? [item] : [];
  });
}

function projectCoreNavigationSections(
  sections: readonly CockpitShellNavigationSection[],
  liveState: CockpitShellLiveState | undefined,
): readonly CockpitShellNavigationSection[] {
  const pendingApprovalBadge = approvalPendingBadge(liveState?.pendingApprovalCount ?? 0);
  if (!pendingApprovalBadge) return sections;

  return sections.map((section) => ({
    ...section,
    items: section.items?.map((item) =>
      item.id === 'inbox' || item.id === 'approvals'
        ? { ...item, badge: pendingApprovalBadge }
        : item,
    ),
  }));
}

function hideDefaultInternalCockpitSurfaces(
  sections: readonly CockpitShellNavigationSection[],
): readonly CockpitShellNavigationSection[] {
  return sections
    .filter((section) => !DEFAULT_HIDDEN_SECTION_IDS.has(section.id))
    .map((section) => ({
      ...section,
      items: section.items?.filter((item) => !DEFAULT_HIDDEN_ITEM_IDS.has(item.id)),
    }))
    .filter((section) => section.comingSoon || (section.items?.length ?? 0) > 0);
}

function approvalPendingBadge(
  pendingApprovalCount: number,
): CockpitShellNavigationBadge | undefined {
  if (pendingApprovalCount <= 0) return undefined;

  const label = `${pendingApprovalCount} pending`;
  return {
    value: pendingApprovalCount,
    label,
    ariaLabel: `${label} approvals`,
  };
}

function isValidShellContribution(
  contribution: CockpitShellModeContribution,
  registry: ResolvedCockpitExtensionRegistry,
  baseProfile: CockpitShellProfile,
): boolean {
  const sectionIds = new Set(baseProfile.coreSections.map((section) => section.id));
  const itemIds = new Set(flattenItems(baseProfile.coreSections).map((item) => item.id));
  const routeIds = new Set(registry.routes.map((route) => route.id));
  const navItemIds = new Set(registry.navItems.map((item) => item.id));

  if (
    contribution.defaultRoute &&
    (!routeIds.has(contribution.defaultRoute.routeId) ||
      registry.routes
        .find((route) => route.id === contribution.defaultRoute?.routeId)
        ?.path.includes('$'))
  ) {
    return false;
  }

  if (
    contribution.sidebarExtensionInsertAfterSectionId &&
    !sectionIds.has(contribution.sidebarExtensionInsertAfterSectionId)
  ) {
    return false;
  }

  if (contribution.coreSections?.some((section) => !sectionIds.has(section.sectionId))) {
    return false;
  }

  if (contribution.coreItems?.some((item) => !itemIds.has(item.itemId))) {
    return false;
  }

  if (contribution.mobilePrimaryCoreItemIds?.some((itemId) => !itemIds.has(itemId))) {
    return false;
  }

  if (contribution.extensionNav?.some((item) => !navItemIds.has(item.navItemId))) {
    return false;
  }

  return true;
}

function canAccessShellContribution(
  contribution: CockpitShellModeContribution,
  registry: ResolvedCockpitExtensionRegistry,
  options: ResolveCockpitShellProfileOptions,
): boolean {
  const accessContext = options.accessContext;
  const persona = options.persona;
  if (!accessContext || !persona) return true;

  const context = { ...accessContext, persona };
  if (contribution.defaultRoute) {
    const route = registry.routes.find((candidate) => candidate.id === contribution.defaultRoute?.routeId);
    if (!route || !canAccessExtensionRoute(route, context).allowed) return false;
  }

  for (const item of contribution.extensionNav ?? []) {
    const navItem = registry.navItems.find((candidate) => candidate.id === item.navItemId);
    if (!navItem || !canAccessExtensionNavItem(navItem, registry, context).allowed) return false;
  }

  return true;
}

function projectProfileCoreSections(
  sections: readonly CockpitShellNavigationSection[],
  contribution: CockpitShellModeContribution,
): readonly CockpitShellNavigationSection[] {
  const sectionPreferences = new Map(
    contribution.coreSections?.map((section) => [section.sectionId, section]) ?? [],
  );
  const itemPreferences = new Map(
    contribution.coreItems?.map((item) => [item.itemId, item]) ?? [],
  );

  return sections
    .map((section, index) => ({
      section,
      index,
      preference: sectionPreferences.get(section.id),
    }))
    .filter(({ preference }) => preference?.visibility !== 'hidden')
    .sort(
      (a, b) =>
        readContributionOrder(a.preference, a.index) -
        readContributionOrder(b.preference, b.index),
    )
    .map(({ section }) => ({
      ...section,
      items: section.items
        ?.map((item, index) => ({ item, index, preference: itemPreferences.get(item.id) }))
        .filter(({ preference }) => preference?.visibility !== 'hidden')
        .sort(
          (a, b) =>
            readContributionOrder(a.preference, a.index) -
            readContributionOrder(b.preference, b.index),
        )
        .map(({ item }) => item),
    }));
}

function readContributionOrder(
  preference:
    | { readonly visibility?: 'visible' | 'advanced' | 'hidden'; readonly order?: number }
    | undefined,
  fallbackIndex: number,
): number {
  if (typeof preference?.order === 'number' && Number.isFinite(preference.order)) {
    return preference.order;
  }

  return preference?.visibility === 'advanced' ? fallbackIndex + 1000 : fallbackIndex;
}

function projectGlobalActionExclusions(
  baseExclusions: ReadonlySet<string>,
  contribution: CockpitShellModeContribution,
): ReadonlySet<string> {
  const exclusions = new Set(baseExclusions);

  for (const action of contribution.globalActions ?? []) {
    if (action.visibility === 'visible') {
      exclusions.delete(action.actionId);
    } else if (action.visibility === 'hidden') {
      exclusions.add(action.actionId);
    }
  }

  return exclusions;
}

function extensionIcon(icon: CockpitExtensionIcon) {
  const className = 'h-4 w-4';
  switch (icon) {
    case 'activity':
      return <Activity className={className} />;
    case 'boxes':
      return <Boxes className={className} />;
    case 'clipboard-check':
      return <ClipboardCheck className={className} />;
    case 'external-link':
      return <ExternalLink className={className} />;
    case 'map':
      return <MapIcon className={className} />;
    case 'plug':
      return <Plug className={className} />;
    case 'route':
      return <RouteIcon className={className} />;
    case 'shield-check':
      return <ShieldCheck className={className} />;
  }
}
