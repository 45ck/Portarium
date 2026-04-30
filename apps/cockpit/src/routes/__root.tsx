import { useEffect, useState } from 'react';
import { createRootRoute, Outlet, Link, useNavigate } from '@tanstack/react-router';
import { useAuthStore, setupDeepLinkAuthHandler } from '@/stores/auth-store';
import { loadOidcConfig, isOidcConfigured } from '@/lib/oidc-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useIsMobile } from '@/hooks/use-mobile';
import { useApprovals } from '@/hooks/queries/use-approvals';
import { useApprovalEventStream } from '@/hooks/queries/use-approval-event-stream';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { useUIStore } from '@/stores/ui-store';
import { parseApprovalNavigationTarget } from '@/lib/approval-navigation';
import { readBearerToken } from '@/lib/auth-token';
import { getNotificationTargetUrl, onNotificationActionPerformed } from '@/lib/push-notifications';
import { cn } from '@/lib/utils';
import { EntityIcon } from '@/components/domain/entity-icon';
import { ErrorBoundary } from '@/components/cockpit/error-boundary';
import { MobileBottomNav } from '@/components/cockpit/mobile-bottom-nav';
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
import { RuntimeStatusStrip } from '@/components/cockpit/runtime-status-strip';
import { StartRunDialog } from '@/components/cockpit/start-run-dialog';
import { IntentPlanSheet } from '@/components/cockpit/intent-plan-sheet';
import { resolveInstalledCockpitExtensionRegistry } from '@/lib/extensions/installed';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import { selectExtensionNavItems } from '@/lib/extensions/registry';
import { shouldEnableRoboticsDemo } from '@/lib/robotics-runtime';
import type { CockpitExtensionIcon } from '@/lib/extensions/types';
import { Toaster } from 'sonner';
import {
  Activity,
  LayoutDashboard,
  Settings,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ExternalLink,
  Scale,
  Inbox,
  Search,
  ShieldAlert,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  GitBranch,
  Map,
  Plug,
  Route as RouteIcon,
  Users,
  Sliders,
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

interface WorkspaceOption {
  workspaceId: string;
  name: string;
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
      {
        label: 'Search',
        to: '/search',
        icon: <Search className="h-4 w-4" />,
      },
    ],
  },
  {
    label: 'Engineering',
    items: [
      {
        label: 'Beads',
        to: '/engineering/beads',
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        label: 'Mission Control',
        to: '/engineering/mission-control',
        icon: <LayoutDashboard className="h-4 w-4" />,
        comingSoon: true,
      },
      {
        label: 'Autonomy',
        to: '/engineering/autonomy',
        icon: <Sliders className="h-4 w-4" />,
        comingSoon: true,
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
        label: 'Machines',
        to: '/config/machines',
        icon: <EntityIcon entityType="machine" size="sm" decorative />,
      },
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
        label: 'Policies',
        to: '/config/policies',
        icon: <EntityIcon entityType="policy" size="sm" decorative />,
      },
      {
        label: 'Blast Radius',
        to: '/config/blast-radius',
        icon: <ShieldAlert className="h-4 w-4" />,
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
      {
        label: 'Pack Runtime',
        to: '/explore/pack-runtime',
        icon: <Settings className="h-4 w-4" />,
      },
      {
        label: 'Extensions',
        to: '/explore/extensions',
        icon: <Plug className="h-4 w-4" />,
      },
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
      return <Map className={className} />;
    case 'plug':
      return <Plug className={className} />;
    case 'route':
      return <RouteIcon className={className} />;
    case 'shield-check':
      return <ShieldCheck className={className} />;
  }
}

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
    <span className="ml-auto rounded-full bg-primary/15 text-primary text-[11px] px-1.5 py-0.5 font-medium leading-none">
      {pendingCount} pending
    </span>
  );
}

function ApprovalEventStreamSubscriber() {
  const wsId = useUIStore((s) => s.activeWorkspaceId);
  useApprovalEventStream(wsId);
  return null;
}

function RootShell() {
  useTheme();
  useKeyboardShortcuts();
  const isMobile = useIsMobile();
  const authStatus = useAuthStore((state) => state.status);
  const claims = useAuthStore((state) => state.claims);
  const navigate = useNavigate();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activePersona,
    setActivePersona,
    startRunOpen,
    setStartRunOpen,
    intentPlannerOpen,
    setIntentPlannerOpen,
  } = useUIStore();
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([]);
  const oidcEnabled = isOidcConfigured(loadOidcConfig());
  const hasBearerToken = Boolean(readBearerToken());
  const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;
  const isAuthRoute = currentPath.startsWith('/auth/');
  const shouldRedirectToLogin =
    authStatus === 'unauthenticated' && oidcEnabled && !hasBearerToken && !isAuthRoute;
  const apiAccessReady =
    !isAuthRoute && (!oidcEnabled || authStatus === 'authenticated' || hasBearerToken);
  const extensionContextQuery = useCockpitExtensionContext(
    apiAccessReady ? activeWorkspaceId : '',
    claims?.sub,
  );
  const extensionServerAccess = resolveCockpitExtensionServerAccess({
    workspaceId: activeWorkspaceId,
    principalId: claims?.sub,
    persona: activePersona,
    serverContext:
      extensionContextQuery.isSuccess && !extensionContextQuery.isFetching
        ? extensionContextQuery.data
        : null,
  });
  const extensionRegistry = resolveInstalledCockpitExtensionRegistry({
    activePackIds: extensionServerAccess.activePackIds,
    quarantinedExtensionIds: extensionServerAccess.quarantinedExtensionIds,
    availableCapabilities: extensionServerAccess.accessContext.availableCapabilities,
    availableApiScopes: extensionServerAccess.accessContext.availableApiScopes,
  });
  const extensionNavItems: NavItemDef[] = selectExtensionNavItems(
    extensionRegistry,
    'sidebar',
    activePersona,
    extensionServerAccess.accessContext,
  )
    .filter((item) => !item.to.includes('$'))
    .map((item) => ({
      label: item.title,
      to: item.to,
      icon: extensionIcon(item.icon),
    }));
  const baseNavSections = shouldEnableRoboticsDemo()
    ? NAV_SECTIONS
    : NAV_SECTIONS.filter((section) => section.label !== 'Robotics');
  const navSections =
    extensionNavItems.length > 0
      ? [...baseNavSections, { label: 'Extensions', items: extensionNavItems }]
      : baseNavSections;

  // ── Auth initialization ────────────────────────────────────────────────────

  // Initialize auth state from secure storage on first mount.
  useEffect(() => {
    if (useAuthStore.getState().status === 'initializing') {
      void useAuthStore.getState().initialize();
    }
  }, []);

  // Register native deep-link handler for OIDC callbacks and approval links.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void setupDeepLinkAuthHandler((target) => {
      void navigate(target);
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [navigate]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void onNotificationActionPerformed((payload) => {
      const targetUrl = getNotificationTargetUrl(payload);
      const target = parseApprovalNavigationTarget(targetUrl);
      if (target) void navigate(target);
    }).then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, [navigate]);

  // Redirect to login when unauthenticated (OIDC configured, no dev token).
  useEffect(() => {
    if (shouldRedirectToLogin) {
      void navigate({ to: '/auth/login' });
    }
  }, [navigate, shouldRedirectToLogin]);

  // Handle web redirect callback (query params on page load).
  useEffect(() => {
    const url = window.location.href;
    const isCallback =
      url.includes('/auth/callback') || (url.includes('code=') && url.includes('state='));
    if (isCallback) {
      void useAuthStore.getState().handleCallback(url);
    }
  }, []);

  // ── Workspace loading ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceOptions() {
      if (!apiAccessReady) {
        if (!cancelled) {
          setWorkspaceOptions([]);
        }
        return;
      }

      try {
        const res = await fetch('/v1/workspaces', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { items?: Record<string, unknown>[] };
        const items = Array.isArray(body.items)
          ? body.items
              .map((item) => {
                const workspaceId = typeof item.workspaceId === 'string' ? item.workspaceId : '';
                const name = typeof item.name === 'string' ? item.name : workspaceId;
                return workspaceId ? { workspaceId, name } : null;
              })
              .filter((item): item is WorkspaceOption => item !== null)
          : [];
        if (!cancelled) {
          setWorkspaceOptions(items);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceOptions([]);
        }
      }
    }

    void loadWorkspaceOptions();

    return () => {
      cancelled = true;
    };
  }, [apiAccessReady]);

  useEffect(() => {
    if (workspaceOptions.length === 0) return;
    if (!workspaceOptions.some((ws) => ws.workspaceId === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaceOptions[0]!.workspaceId);
    }
  }, [workspaceOptions, activeWorkspaceId, setActiveWorkspaceId]);

  // Show loading spinner while auth state is being resolved.
  if (authStatus === 'initializing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"
          role="status"
          aria-label="Loading…"
        />
      </div>
    );
  }

  if (isAuthRoute) {
    return <Outlet />;
  }

  if (shouldRedirectToLogin) {
    return null;
  }

  return (
    <>
      {apiAccessReady ? <ApprovalEventStreamSubscriber /> : null}
      <TooltipProvider>
        <div className="flex h-screen bg-background text-foreground">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-background focus:rounded"
          >
            Skip to content
          </a>
          {/* Sidebar — hidden on mobile */}
          {!isMobile && (
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
                {navSections.map((section) => (
                  <div key={section.label} className="space-y-0.5">
                    {!sidebarCollapsed && (
                      <p className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        {section.label}
                      </p>
                    )}
                    {section.comingSoon ? (
                      <p className="px-2.5 py-1.5 text-xs text-muted-foreground italic">
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
                                <span className="ml-1.5 text-[11px] italic">soon</span>
                              </span>
                            )}
                          </span>
                        ) : (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            collapsed={sidebarCollapsed}
                            label={item.label}
                          >
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
                    <span
                      className="text-[11px] text-muted-foreground truncate block text-center"
                      title={activePersona}
                    >
                      {activePersona.slice(0, 2)}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block text-center">
                      {activeWorkspaceId.replace('ws-', '').slice(0, 3)}
                    </span>
                  </>
                ) : (
                  <>
                    <Select
                      value={activePersona}
                      onValueChange={(v) => setActivePersona(v as PersonaId)}
                    >
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
                        {workspaceOptions.length > 0 ? (
                          workspaceOptions.map((workspace) => (
                            <SelectItem key={workspace.workspaceId} value={workspace.workspaceId}>
                              {workspace.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={activeWorkspaceId}>{activeWorkspaceId}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </aside>
          )}

          {/* Main content — add bottom padding on mobile for bottom nav */}
          <main
            id="main-content"
            className={cn('flex-1 overflow-y-auto overflow-x-hidden', isMobile && 'pb-14')}
          >
            <RuntimeStatusStrip />
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>

        {/* Mobile bottom nav */}
        {isMobile && (
          <MobileBottomNav
            activeWorkspaceId={activeWorkspaceId}
            activePersona={activePersona}
            workspaceOptions={workspaceOptions}
            onWorkspaceChange={setActiveWorkspaceId}
            onPersonaChange={setActivePersona}
          />
        )}

        {/* Global overlays */}
        <StartRunDialog open={startRunOpen} onOpenChange={setStartRunOpen} />
        <IntentPlanSheet open={intentPlannerOpen} onOpenChange={setIntentPlannerOpen} />
        <CommandPalette />
        <KeyboardCheatsheet />
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </>
  );
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootShell />
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
