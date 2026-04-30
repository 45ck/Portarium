import { useEffect } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import { useTheme } from '@/hooks/use-theme';
import { useUIStore } from '@/stores/ui-store';
import { router } from '@/router';
import { EntityIcon } from '@/components/domain/entity-icon';
import {
  DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  DEFAULT_COCKPIT_EXTENSION_REGISTRY,
} from '@/lib/extensions/installed';
import { selectExtensionCommands } from '@/lib/extensions/registry';
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  Scale,
  Inbox,
  ShieldAlert,
  Play,
  UserPlus,
  Palette,
  PanelLeft,
  Database,
  GitBranchPlus,
  Plug,
} from 'lucide-react';

interface CommandItemDef {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

const extensionRoutePaths = new Map(
  DEFAULT_COCKPIT_EXTENSION_REGISTRY.routes.map((route) => [route.id, route.path]),
);

function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, activePersona } = useUIStore();
  const { theme, setTheme, themes } = useTheme();

  // Global Ctrl+K / Cmd+K hotkey
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const current = useUIStore.getState().commandPaletteOpen;
        useUIStore.getState().setCommandPaletteOpen(!current);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function nav(to: string) {
    setCommandPaletteOpen(false);
    void router.navigate({ to: to as never });
  }

  const extensionNavigationItems = selectExtensionCommands(
    DEFAULT_COCKPIT_EXTENSION_REGISTRY,
    activePersona,
    DEFAULT_COCKPIT_EXTENSION_ACCESS_CONTEXT,
  ).reduce<CommandItemDef[]>((items, command) => {
    const routePath = command.routeId ? extensionRoutePaths.get(command.routeId) : undefined;
    if (!routePath || routePath.includes('$')) return items;

    items.push({
      label: command.title,
      icon: <Plug className="h-4 w-4" />,
      shortcut: command.shortcut,
      onSelect: () => nav(routePath),
    });
    return items;
  }, []);

  const navigationItems: CommandItemDef[] = [
    {
      label: 'Inbox',
      icon: <Inbox className="h-4 w-4" />,
      shortcut: 'G I',
      onSelect: () => nav('/inbox'),
    },
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: 'G D',
      onSelect: () => nav('/dashboard'),
    },
    {
      label: 'Work Items',
      icon: <EntityIcon entityType="work-item" size="sm" decorative />,
      shortcut: 'G W',
      onSelect: () => nav('/work-items'),
    },
    {
      label: 'Runs',
      icon: <EntityIcon entityType="run" size="sm" decorative />,
      shortcut: 'G R',
      onSelect: () => nav('/runs'),
    },
    {
      label: 'Workflows',
      icon: <EntityIcon entityType="workflow" size="sm" decorative />,
      onSelect: () => nav('/workflows'),
    },
    {
      label: 'Approvals',
      icon: <EntityIcon entityType="approval" size="sm" decorative />,
      shortcut: 'G A',
      onSelect: () => nav('/approvals'),
    },
    {
      label: 'Evidence',
      icon: <EntityIcon entityType="evidence" size="sm" decorative />,
      shortcut: 'G E',
      onSelect: () => nav('/evidence'),
    },
    {
      label: 'Members',
      icon: <EntityIcon entityType="workforce" size="sm" decorative />,
      onSelect: () => nav('/workforce'),
    },
    {
      label: 'Queues',
      icon: <EntityIcon entityType="queue" size="sm" decorative />,
      onSelect: () => nav('/workforce/queues'),
    },
    {
      label: 'Agents',
      icon: <EntityIcon entityType="agent" size="sm" decorative />,
      onSelect: () => nav('/config/agents'),
    },
    {
      label: 'Adapters',
      icon: <EntityIcon entityType="adapter" size="sm" decorative />,
      onSelect: () => nav('/config/adapters'),
    },
    {
      label: 'Credentials',
      icon: <EntityIcon entityType="credential" size="sm" decorative />,
      onSelect: () => nav('/config/credentials'),
    },
    {
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => nav('/config/settings'),
    },
    {
      label: 'Objects',
      icon: <EntityIcon entityType="external-object-ref" size="sm" decorative />,
      onSelect: () => nav('/explore/objects'),
    },
    {
      label: 'Events',
      icon: <EntityIcon entityType="event" size="sm" decorative />,
      onSelect: () => nav('/explore/events'),
    },
    {
      label: 'Observability',
      icon: <BarChart3 className="h-4 w-4" />,
      onSelect: () => nav('/explore/observability'),
    },
    {
      label: 'Governance',
      icon: <Scale className="h-4 w-4" />,
      onSelect: () => nav('/explore/governance'),
    },
    {
      label: 'Extensions',
      icon: <Plug className="h-4 w-4" />,
      onSelect: () => nav('/explore/extensions'),
    },
    {
      label: 'Robots',
      icon: <EntityIcon entityType="robot" size="sm" decorative />,
      onSelect: () => nav('/robotics/robots'),
    },
    {
      label: 'Missions',
      icon: <EntityIcon entityType="mission" size="sm" decorative />,
      onSelect: () => nav('/robotics/missions'),
    },
    {
      label: 'Safety',
      icon: <ShieldAlert className="h-4 w-4" />,
      onSelect: () => nav('/robotics/safety'),
    },
    {
      label: 'Gateways',
      icon: <EntityIcon entityType="port" size="sm" decorative />,
      onSelect: () => nav('/robotics/gateways'),
    },
    ...extensionNavigationItems,
  ];

  const actionItems: CommandItemDef[] = [
    {
      label: 'New Run',
      icon: <Play className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setStartRunOpen(true);
      },
    },
    {
      label: 'Plan New Beads',
      icon: <GitBranchPlus className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setIntentPlannerOpen(true);
      },
    },
    {
      label: 'Register Agent',
      icon: <UserPlus className="h-4 w-4" />,
      onSelect: () => nav('/config/agents'),
    },
    {
      label: 'Toggle Theme',
      icon: <Palette className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
        if (nextTheme) setTheme(nextTheme);
      },
    },
  ];

  const settingsItems: CommandItemDef[] = [
    {
      label: 'Toggle Sidebar',
      icon: <PanelLeft className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setSidebarCollapsed(!useUIStore.getState().sidebarCollapsed);
      },
    },
    {
      label: 'Switch Dataset',
      icon: <Database className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        nav('/config/settings');
      },
    },
  ];

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      showCloseButton={false}
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem key={`${item.label}-${item.shortcut ?? ''}`} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem key={`${item.label}-${item.shortcut ?? ''}`} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {settingsItems.map((item) => (
            <CommandItem key={`${item.label}-${item.shortcut ?? ''}`} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export { CommandPalette };
