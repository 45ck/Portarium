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
import { selectExtensionCommands, selectExtensionNavItems } from '@/lib/extensions/registry';
import type {
  CockpitExtensionAccessContext,
  CockpitExtensionIcon,
  ResolvedCockpitExtensionRegistry,
} from '@/lib/extensions/types';
import type { PersonaId } from '@/stores/ui-store';

export interface CockpitShellNavigationItem {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  comingSoon?: boolean;
  shortcut?: string;
  matchPath?: string;
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

export interface ProjectCockpitShellNavigationInput {
  registry: ResolvedCockpitExtensionRegistry;
  persona: PersonaId;
  accessContext: CockpitExtensionAccessContext;
  roboticsEnabled: boolean;
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
        comingSoon: true,
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
const MOBILE_MORE_SECTION_IDS = new Set(['workspace', 'work', 'workforce', 'config', 'explore']);
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

export function projectCockpitShellNavigation({
  registry,
  persona,
  accessContext,
  roboticsEnabled,
}: ProjectCockpitShellNavigationInput): CockpitShellProjection {
  const coreSections = roboticsEnabled
    ? CORE_SHELL_SECTIONS
    : CORE_SHELL_SECTIONS.filter((section) => section.id !== 'robotics');
  const extensionSidebarItems = selectExtensionNavItems(registry, 'sidebar', persona, accessContext)
    .filter(isConcretePathItem)
    .map(
      (item): CockpitShellNavigationItem => ({
        id: `extension-nav:${item.id}`,
        label: item.title,
        to: item.to,
        icon: extensionIcon(item.icon),
        matchPath: item.to,
      }),
    );
  const extensionMobileMoreItems = selectExtensionNavItems(
    registry,
    'mobile-more',
    persona,
    accessContext,
  )
    .filter(isConcretePathItem)
    .map(
      (item): CockpitShellNavigationItem => ({
        id: `extension-mobile:${item.id}`,
        label: item.title,
        to: item.to,
        icon: extensionIcon(item.icon),
        matchPath: item.to,
      }),
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

  const sidebarSections =
    extensionSidebarItems.length > 0
      ? [...coreSections, extensionSection(extensionSidebarItems)]
      : coreSections;
  const mobileMoreBaseSections = coreSections.filter((section) =>
    MOBILE_MORE_SECTION_IDS.has(section.id),
  );
  const mobileMoreSections =
    extensionMobileMoreItems.length > 0
      ? [...mobileMoreBaseSections, extensionSection(extensionMobileMoreItems)]
      : mobileMoreBaseSections;

  return {
    sidebarSections,
    mobilePrimaryItems: projectMobilePrimaryItems(coreSections),
    mobileMoreSections,
    commandTargets: [
      ...flattenItems(coreSections)
        .filter((item) => !item.comingSoon && !COMMAND_EXCLUDED_ITEM_IDS.has(item.id))
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

function isConcretePathItem(item: { to: string }): boolean {
  return !item.to.includes('$');
}

function extensionSection(
  items: readonly CockpitShellNavigationItem[],
): CockpitShellNavigationSection {
  return {
    id: 'extensions',
    label: 'Extensions',
    items,
  };
}

function flattenItems(
  sections: readonly CockpitShellNavigationSection[],
): readonly CockpitShellNavigationItem[] {
  return sections.flatMap((section) => section.items ?? []);
}

function projectMobilePrimaryItems(
  sections: readonly CockpitShellNavigationSection[],
): readonly CockpitShellNavigationItem[] {
  const itemsById = new Map(flattenItems(sections).map((item) => [item.id, item]));
  return MOBILE_PRIMARY_ITEM_IDS.flatMap((itemId) => {
    const item = itemsById.get(itemId);
    return item ? [item] : [];
  });
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
