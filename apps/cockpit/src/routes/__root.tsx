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
import { usePendingCount } from '@/hooks/use-pending-count';
import { useApprovalEventStream } from '@/hooks/queries/use-approval-event-stream';
import { useCockpitExtensionRegistry } from '@/hooks/use-cockpit-extension-registry';
import { useUIStore } from '@/stores/ui-store';
import { parseApprovalNavigationTarget } from '@/lib/approval-navigation';
import { readBearerToken } from '@/lib/auth-token';
import { getNotificationTargetUrl, onNotificationActionPerformed } from '@/lib/push-notifications';
import { cn } from '@/lib/utils';
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
import { projectCockpitShellNavigation } from '@/lib/shell/navigation';
import { shouldEnableRoboticsDemo } from '@/lib/robotics-runtime';
import { Toaster } from 'sonner';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { PersonaId } from '@/stores/ui-store';
import type {
  CockpitShellNavigationBadge,
  CockpitShellNavigationItem,
} from '@/lib/shell/navigation';

interface WorkspaceOption {
  workspaceId: string;
  name: string;
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
      className="relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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

function ShellNavBadge({ badge }: { badge: CockpitShellNavigationBadge }) {
  return (
    <span
      className="ml-auto rounded-full bg-primary/15 text-primary text-[11px] px-1.5 py-0.5 font-medium leading-none"
      aria-label={badge.ariaLabel}
    >
      {badge.label}
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
  const pendingApprovalCount = usePendingCount(activeWorkspaceId);
  const currentPath = typeof window === 'undefined' ? '' : window.location.pathname;
  const isAuthRoute = currentPath.startsWith('/auth/');
  const shouldRedirectToLogin =
    authStatus === 'unauthenticated' && oidcEnabled && !hasBearerToken && !isAuthRoute;
  const apiAccessReady =
    !isAuthRoute && (!oidcEnabled || authStatus === 'authenticated' || hasBearerToken);
  const { registry: extensionRegistry, serverAccess: extensionServerAccess } =
    useCockpitExtensionRegistry({
      workspaceId: activeWorkspaceId,
      persona: activePersona,
      enabled: apiAccessReady,
    });
  const shellProjection = projectCockpitShellNavigation({
    registry: extensionRegistry,
    persona: activePersona,
    accessContext: extensionServerAccess.accessContext,
    roboticsEnabled: shouldEnableRoboticsDemo(),
    liveState: { pendingApprovalCount },
  });
  const navSections = shellProjection.sidebarSections;

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
                  <div key={section.id} className="space-y-0.5">
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
                      section.items?.map((item: CockpitShellNavigationItem) =>
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
                            {item.badge && sidebarCollapsed && (
                              <span
                                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary"
                                aria-label={item.badge.ariaLabel}
                              />
                            )}
                            {item.badge && !sidebarCollapsed && (
                              <ShellNavBadge badge={item.badge} />
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
            primaryItems={shellProjection.mobilePrimaryItems}
            moreSections={shellProjection.mobileMoreSections}
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
