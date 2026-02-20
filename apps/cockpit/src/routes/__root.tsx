import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ErrorBoundary } from '@/components/cockpit/error-boundary';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CommandPalette } from '@/components/cockpit/command-palette';
import { KeyboardCheatsheet } from '@/components/cockpit/keyboard-cheatsheet';
import { Toaster } from 'sonner';
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  Scale,
  Inbox,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  GitBranch,
  Map,
  Users,
} from 'lucide-react';
import type { PersonaId } from '@/stores/ui-store';

interface NavItemDef {
  label: string;
  to: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

interface NavSectionDef {
  label: string;
  items?: NavItemDef[];
  comingSoon?: boolean;
}

const NAV_SECTIONS: NavSectionDef[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Inbox', to: '/inbox', icon: <Inbox className="h-4 w-4" /> },
      { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
      {
        label: 'Work Items',
        to: '/work-items',
        icon: <EntityIcon entityType="work-item" size="sm" decorative />,
      },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Runs', to: '/runs', icon: <EntityIcon entityType="run" size="sm" decorative /> },
      {
        label: 'Workflows',
        to: '/workflows',
        icon: <EntityIcon entityType="workflow" size="sm" decorative />,
      },
      {
        label: 'Builder',
        to: '/workflows/builder',
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        label: 'Approvals',
        to: '/approvals',
        icon: <EntityIcon entityType="approval" size="sm" decorative />,
      },
      {
        label: 'Evidence',
        to: '/evidence',
        icon: <EntityIcon entityType="evidence" size="sm" decorative />,
      },
    ],
  },
  {
    label: 'Workforce',
    items: [
      {
        label: 'Members',
        to: '/workforce',
        icon: <EntityIcon entityType="workforce" size="sm" decorative />,
      },
      {
        label: 'Queues',
        to: '/workforce/queues',
        icon: <EntityIcon entityType="queue" size="sm" decorative />,
      },
    ],
  },
  {
    label: 'Config',
    items: [
      {
        label: 'Agents',
        to: '/config/agents',
        icon: <EntityIcon entityType="agent" size="sm" decorative />,
      },
      {
        label: 'Adapters',
        to: '/config/adapters',
        icon: <EntityIcon entityType="adapter" size="sm" decorative />,
      },
      {
        label: 'Credentials',
        to: '/config/credentials',
        icon: <EntityIcon entityType="credential" size="sm" decorative />,
      },
      {
        label: 'Users',
        to: '/config/users',
        icon: <Users className="h-4 w-4" />,
      },
      { label: 'Settings', to: '/config/settings', icon: <Settings className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Explore',
    items: [
      {
        label: 'Objects',
        to: '/explore/objects',
        icon: <EntityIcon entityType="external-object-ref" size="sm" decorative />,
      },
      {
        label: 'Events',
        to: '/explore/events',
        icon: <EntityIcon entityType="event" size="sm" decorative />,
      },
      {
        label: 'Observability',
        to: '/explore/observability',
        icon: <BarChart3 className="h-4 w-4" />,
      },
      { label: 'Governance', to: '/explore/governance', icon: <Scale className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Robotics',
    items: [
      {
        label: 'Map',
        to: '/robotics/map',
        icon: <Map className="h-4 w-4" />,
      },
      {
        label: 'Robots',
        to: '/robotics/robots',
        icon: <EntityIcon entityType="robot" size="sm" decorative />,
      },
      {
        label: 'Missions',
        to: '/robotics/missions',
        icon: <EntityIcon entityType="mission" size="sm" decorative />,
      },
      { label: 'Safety', to: '/robotics/safety', icon: <ShieldAlert className="h-4 w-4" /> },
      {
        label: 'Gateways',
        to: '/robotics/gateways',
        icon: <EntityIcon entityType="port" size="sm" decorative />,
      },
    ],
  },
];

// Wrapper to avoid TS errors while child routes are not yet registered.
// Once all route files are in place the router's type map will include
// every path and this cast will be redundant but harmless.
function NavLink({
  to,
  collapsed,
  label,
  children,
}: {
  to: string;
  collapsed: boolean;
  label: string;
  children: React.ReactNode;
}) {
  // Cast via `unknown` so the nav works before all routes are registered in the tree.
  // Once router.ts wires every route the cast becomes redundant but stays harmless.
  const TypedLink = Link as React.ComponentType<{
    to: string;
    className?: string;
    activeProps?: { className?: string };
    'aria-label'?: string;
    children?: React.ReactNode;
  }>;

  const link = (
    <TypedLink
      to={to}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      activeProps={{ className: 'bg-accent text-accent-foreground font-medium' }}
      aria-label={collapsed ? label : undefined}
    >
      {children}
    </TypedLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function InboxBadge({ wsId }: { wsId: string }) {
  const { data } = useApprovals(wsId);
  const pendingCount = (data?.items ?? []).filter((a) => a.status === 'Pending').length;
  if (pendingCount === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 font-medium leading-none">
      {pendingCount}
    </span>
  );
}

function RootLayout() {
  useTheme();
  useKeyboardShortcuts();
  const { sidebarCollapsed, setSidebarCollapsed, activeWorkspaceId, setActiveWorkspaceId, activePersona, setActivePersona } =
    useUIStore();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen bg-background text-foreground">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-background focus:rounded"
          >
            Skip to content
          </a>
          {/* Sidebar */}
          <aside
            className={cn(
              'flex-shrink-0 border-r border-border bg-card flex flex-col transition-all duration-200',
              sidebarCollapsed ? 'w-16' : 'w-64',
            )}
          >
            {/* Logo + collapse toggle */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center min-w-0">
                <span className="font-semibold text-primary">Portarium</span>
                {!sidebarCollapsed && (
                  <span className="ml-2 text-xs text-muted-foreground">Cockpit</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Nav */}
            <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-2 space-y-3">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-0.5">
                  {!sidebarCollapsed && (
                    <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      {section.label}
                    </p>
                  )}
                  {section.comingSoon ? (
                    <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground italic">
                      Coming soon
                    </p>
                  ) : (
                    section.items?.map((item) =>
                      item.comingSoon ? (
                        <span
                          key={item.to}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground/50 cursor-default"
                          title="Coming soon"
                        >
                          <span className="shrink-0 opacity-50">{item.icon}</span>
                          {!sidebarCollapsed && (
                            <span className="flex-1 text-left truncate">
                              {item.label}
                              <span className="ml-1.5 text-[10px] italic">soon</span>
                            </span>
                          )}
                        </span>
                      ) : (
                        <NavLink key={item.to} to={item.to} collapsed={sidebarCollapsed} label={item.label}>
                          <span className="shrink-0">{item.icon}</span>
                          {!sidebarCollapsed && (
                            <span className="flex-1 text-left truncate">{item.label}</span>
                          )}
                          {item.to === '/inbox' && !sidebarCollapsed && (
                            <InboxBadge wsId={activeWorkspaceId} />
                          )}
                        </NavLink>
                      ),
                    )
                  )}
                </div>
              ))}
            </nav>

            {/* Bottom: persona + workspace selector */}
            <div className="p-3 border-t border-border space-y-2">
              {sidebarCollapsed ? (
                <>
                  <span className="text-[10px] text-muted-foreground truncate block text-center" title={activePersona}>
                    {activePersona.slice(0, 2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block text-center">
                    {activeWorkspaceId.replace('ws-', '').slice(0, 3)}
                  </span>
                </>
              ) : (
                <>
                  <Select value={activePersona} onValueChange={(v) => setActivePersona(v as PersonaId)}>
                    <SelectTrigger size="sm" className="w-full text-xs h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Operator">Operator</SelectItem>
                      <SelectItem value="Approver">Approver</SelectItem>
                      <SelectItem value="Auditor">Auditor</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={activeWorkspaceId} onValueChange={setActiveWorkspaceId}>
                    <SelectTrigger size="sm" className="w-full text-xs h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ws-demo">ws-demo</SelectItem>
                      <SelectItem value="ws-prod">ws-prod</SelectItem>
                      <SelectItem value="ws-staging">ws-staging</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </aside>

          {/* Main content */}
          <main id="main-content" className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>

        {/* Global overlays */}
        <CommandPalette />
        <KeyboardCheatsheet />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
