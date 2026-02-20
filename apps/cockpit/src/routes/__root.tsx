import { createRootRoute, Outlet, Link, type LinkProps } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from '@/lib/query-client'
import { useTheme } from '@/hooks/use-theme'
import { useUIStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Briefcase,
  Play,
  CheckSquare,
  Shield,
  Users,
  ListOrdered,
  Bot,
  Plug,
  Settings,
  Database,
  Activity,
  BarChart3,
  Scale,
  Cpu,
} from 'lucide-react'

interface NavItemDef {
  label: string
  to: string
  icon: React.ReactNode
}

interface NavSectionDef {
  label: string
  items?: NavItemDef[]
  comingSoon?: boolean
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: 'Work Items', to: '/work-items', icon: <Briefcase className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Runs', to: '/runs', icon: <Play className="h-4 w-4" /> },
      { label: 'Approvals', to: '/approvals', icon: <CheckSquare className="h-4 w-4" /> },
      { label: 'Evidence', to: '/evidence', icon: <Shield className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { label: 'Members', to: '/workforce', icon: <Users className="h-4 w-4" /> },
      { label: 'Queues', to: '/workforce/queues', icon: <ListOrdered className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Config',
    items: [
      { label: 'Agents', to: '/config/agents', icon: <Bot className="h-4 w-4" /> },
      { label: 'Adapters', to: '/config/adapters', icon: <Plug className="h-4 w-4" /> },
      { label: 'Settings', to: '/config/settings', icon: <Settings className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Explore',
    items: [
      { label: 'Objects', to: '/explore/objects', icon: <Database className="h-4 w-4" /> },
      { label: 'Events', to: '/explore/events', icon: <Activity className="h-4 w-4" /> },
      { label: 'Observability', to: '/explore/observability', icon: <BarChart3 className="h-4 w-4" /> },
      { label: 'Governance', to: '/explore/governance', icon: <Scale className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Robotics',
    comingSoon: true,
  },
]

function RootLayout() {
  useTheme()
  const { sidebarCollapsed } = useUIStore()

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen bg-background text-foreground">
          {/* Sidebar */}
          <aside
            className={cn(
              'flex-shrink-0 border-r border-border bg-card flex flex-col transition-all duration-200',
              sidebarCollapsed ? 'w-16' : 'w-64',
            )}
          >
            {/* Logo */}
            <div className="h-14 flex items-center px-4 border-b border-border">
              <span className="font-semibold text-primary">Portarium</span>
              {!sidebarCollapsed && (
                <span className="ml-2 text-xs text-muted-foreground">Cockpit</span>
              )}
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-3">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-0.5">
                  <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {section.label}
                  </p>
                  {section.comingSoon ? (
                    <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground italic">
                      Coming soon
                    </p>
                  ) : (
                    section.items?.map((item) => (
                      <Link
                        key={item.to}
                        {...{ to: item.to } as Record<string, unknown>}
                        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        activeProps={{
                          className: 'bg-accent text-accent-foreground font-medium',
                        }}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {!sidebarCollapsed && (
                          <span className="flex-1 text-left truncate">{item.label}</span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              ))}
            </nav>

            {/* Bottom: workspace info */}
            <div className="p-3 border-t border-border text-xs text-muted-foreground">
              <div>ws-demo</div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
