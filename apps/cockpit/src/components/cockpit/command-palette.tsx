import { useEffect, type ReactNode } from 'react';
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
import { useCockpitExtensionRegistry } from '@/hooks/use-cockpit-extension-registry';
import { projectCockpitShellNavigation } from '@/lib/shell/navigation';
import { shouldEnableRoboticsDemo } from '@/lib/robotics-runtime';
import { Play, UserPlus, Palette, PanelLeft, Database, GitBranchPlus } from 'lucide-react';

interface CommandItemDef {
  id: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, activePersona, activeWorkspaceId } =
    useUIStore();
  const { theme, setTheme, themes } = useTheme();
  const { registry: extensionRegistry, serverAccess: extensionServerAccess } =
    useCockpitExtensionRegistry({
      workspaceId: activeWorkspaceId,
      persona: activePersona,
    });
  const shellProjection = projectCockpitShellNavigation({
    registry: extensionRegistry,
    persona: activePersona,
    accessContext: extensionServerAccess.accessContext,
    roboticsEnabled: shouldEnableRoboticsDemo(),
  });

  function nav(to: string) {
    setCommandPaletteOpen(false);
    void router.navigate({ to: to as never });
  }

  const navigationItems: CommandItemDef[] = shellProjection.commandTargets.map((target) => ({
    id: target.id,
    label: target.label,
    icon: target.icon,
    shortcut: target.shortcut,
    onSelect: () => nav(target.to),
  }));

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

  const actionItems: CommandItemDef[] = [
    {
      id: 'action:new-run',
      label: 'New Run',
      icon: <Play className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setStartRunOpen(true);
      },
    },
    {
      id: 'action:plan-new-beads',
      label: 'Plan New Beads',
      icon: <GitBranchPlus className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setIntentPlannerOpen(true);
      },
    },
    {
      id: 'action:register-agent',
      label: 'Register Agent',
      icon: <UserPlus className="h-4 w-4" />,
      onSelect: () => nav('/config/agents'),
    },
    {
      id: 'action:toggle-theme',
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
      id: 'setting:toggle-sidebar',
      label: 'Toggle Sidebar',
      icon: <PanelLeft className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false);
        useUIStore.getState().setSidebarCollapsed(!useUIStore.getState().sidebarCollapsed);
      },
    },
    {
      id: 'setting:switch-dataset',
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
            <CommandItem key={item.id} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem key={item.id} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {settingsItems.map((item) => (
            <CommandItem key={item.id} onSelect={item.onSelect}>
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
