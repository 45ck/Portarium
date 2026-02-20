import { useEffect } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command'
import { useUIStore } from '@/stores/ui-store'
import { router } from '@/router'
import { EntityIcon } from '@/components/domain/entity-icon'
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
} from 'lucide-react'

interface CommandItemDef {
  label: string
  icon: React.ReactNode
  shortcut?: string
  onSelect: () => void
}

function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()

  // Global Ctrl+K / Cmd+K hotkey
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  function nav(to: string) {
    setCommandPaletteOpen(false)
    router.navigate({ to: to as never })
  }

  const navigationItems: CommandItemDef[] = [
    { label: 'Inbox', icon: <Inbox className="h-4 w-4" />, shortcut: 'G I', onSelect: () => nav('/inbox') },
    { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, shortcut: 'G D', onSelect: () => nav('/dashboard') },
    { label: 'Work Items', icon: <EntityIcon entityType="work-item" size="sm" decorative />, shortcut: 'G W', onSelect: () => nav('/work-items') },
    { label: 'Runs', icon: <EntityIcon entityType="run" size="sm" decorative />, shortcut: 'G R', onSelect: () => nav('/runs') },
    { label: 'Workflows', icon: <EntityIcon entityType="workflow" size="sm" decorative />, onSelect: () => nav('/workflows') },
    { label: 'Approvals', icon: <EntityIcon entityType="approval" size="sm" decorative />, shortcut: 'G A', onSelect: () => nav('/approvals') },
    { label: 'Evidence', icon: <EntityIcon entityType="evidence" size="sm" decorative />, shortcut: 'G E', onSelect: () => nav('/evidence') },
    { label: 'Members', icon: <EntityIcon entityType="workforce" size="sm" decorative />, onSelect: () => nav('/workforce') },
    { label: 'Queues', icon: <EntityIcon entityType="queue" size="sm" decorative />, onSelect: () => nav('/workforce/queues') },
    { label: 'Agents', icon: <EntityIcon entityType="agent" size="sm" decorative />, onSelect: () => nav('/config/agents') },
    { label: 'Adapters', icon: <EntityIcon entityType="adapter" size="sm" decorative />, onSelect: () => nav('/config/adapters') },
    { label: 'Credentials', icon: <EntityIcon entityType="credential" size="sm" decorative />, onSelect: () => nav('/config/credentials') },
    { label: 'Settings', icon: <Settings className="h-4 w-4" />, onSelect: () => nav('/config/settings') },
    { label: 'Objects', icon: <EntityIcon entityType="external-object-ref" size="sm" decorative />, onSelect: () => nav('/explore/objects') },
    { label: 'Events', icon: <EntityIcon entityType="event" size="sm" decorative />, onSelect: () => nav('/explore/events') },
    { label: 'Observability', icon: <BarChart3 className="h-4 w-4" />, onSelect: () => nav('/explore/observability') },
    { label: 'Governance', icon: <Scale className="h-4 w-4" />, onSelect: () => nav('/explore/governance') },
    { label: 'Robots', icon: <EntityIcon entityType="robot" size="sm" decorative />, onSelect: () => nav('/robotics/robots') },
    { label: 'Missions', icon: <EntityIcon entityType="mission" size="sm" decorative />, onSelect: () => nav('/robotics/missions') },
    { label: 'Safety', icon: <ShieldAlert className="h-4 w-4" />, onSelect: () => nav('/robotics/safety') },
    { label: 'Gateways', icon: <EntityIcon entityType="port" size="sm" decorative />, onSelect: () => nav('/robotics/gateways') },
  ]

  const actionItems: CommandItemDef[] = [
    { label: 'New Run', icon: <Play className="h-4 w-4" />, onSelect: () => nav('/runs') },
    { label: 'Register Agent', icon: <UserPlus className="h-4 w-4" />, onSelect: () => nav('/config/agents') },
    {
      label: 'Toggle Theme',
      icon: <Palette className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false)
        // Cycle through themes
        const root = document.documentElement
        const themes = ['theme-arctic', 'theme-midnight', 'theme-warm', 'theme-quantum'] as const
        const current = themes.find((t) => root.classList.contains(t)) ?? 'theme-arctic'
        const nextTheme = themes[(themes.indexOf(current) + 1) % themes.length] ?? 'theme-arctic'
        themes.forEach((t) => root.classList.remove(t))
        root.classList.add(nextTheme)
        try { localStorage.setItem('cockpit-theme', nextTheme) } catch {}
      },
    },
  ]

  const settingsItems: CommandItemDef[] = [
    {
      label: 'Toggle Sidebar',
      icon: <PanelLeft className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false)
        useUIStore.getState().setSidebarCollapsed(!useUIStore.getState().sidebarCollapsed)
      },
    },
    {
      label: 'Switch Dataset',
      icon: <Database className="h-4 w-4" />,
      onSelect: () => {
        setCommandPaletteOpen(false)
        nav('/config/settings')
      },
    },
  ]

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
            <CommandItem key={item.label} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem key={item.label} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          {settingsItems.map((item) => (
            <CommandItem key={item.label} onSelect={item.onSelect}>
              {item.icon}
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

export { CommandPalette }
