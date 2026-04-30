import { Link } from '@tanstack/react-router';
import { AlertCircle, LockKeyhole } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import { resolveInstalledCockpitExtensionRegistry } from '@/lib/extensions/installed';
import { resolveExternalRoute, type ExternalRouteResolution } from './external-route-adapter';
import { HOSTED_EXTERNAL_ROUTE_COMPONENTS } from './external-route-components';

export function ExternalRouteHost({ pathname }: { pathname: string }) {
  const activePersona = useUIStore((state) => state.activePersona);
  const activeWorkspaceId = useUIStore((state) => state.activeWorkspaceId);
  const principalId = useAuthStore((state) => state.claims?.sub);
  const extensionContextQuery = useCockpitExtensionContext(activeWorkspaceId, principalId);
  const serverAccess = resolveCockpitExtensionServerAccess({
    workspaceId: activeWorkspaceId,
    principalId,
    persona: activePersona,
    serverContext:
      extensionContextQuery.isSuccess && !extensionContextQuery.isFetching
        ? extensionContextQuery.data
        : null,
  });
  const registry = resolveInstalledCockpitExtensionRegistry({
    activePackIds: serverAccess.activePackIds,
    quarantinedExtensionIds: serverAccess.quarantinedExtensionIds,
    availableCapabilities: serverAccess.accessContext.availableCapabilities,
    availableApiScopes: serverAccess.accessContext.availableApiScopes,
    availablePrivacyClasses: serverAccess.accessContext.availablePrivacyClasses,
  });
  const resolution = resolveExternalRoute({
    pathname,
    ...serverAccess.accessContext,
    persona: activePersona,
    registry,
    components: HOSTED_EXTERNAL_ROUTE_COMPONENTS,
  });

  if (resolution.kind === 'active') {
    const Component = resolution.component;
    return (
      <Suspense fallback={<ExternalRouteLoading routeTitle={resolution.route.title} />}>
        <Component
          route={resolution.route}
          extension={resolution.extension}
          params={resolution.params}
        />
      </Suspense>
    );
  }

  return <ExternalRouteFallback resolution={resolution} />;
}

function ExternalRouteLoading({ routeTitle }: { routeTitle: string }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title={routeTitle} description="Loading compile-time installed extension route" />
      <Card className="shadow-none">
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <span
            className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"
            role="status"
            aria-label="Loading extension route"
          />
          Preparing route
        </CardContent>
      </Card>
    </div>
  );
}

function ExternalRouteFallback({
  resolution,
}: {
  resolution: Exclude<ExternalRouteResolution, { kind: 'active' }>;
}) {
  switch (resolution.kind) {
    case 'forbidden':
      return (
        <FallbackShell
          title="Extension Route Restricted"
          description="This route is not available for the current server-issued guard context."
          icon={<LockKeyhole className="h-5 w-5" />}
          badges={['restricted', resolution.audit.reason, ...resolution.denials.map((d) => d.code)]}
        >
          <p className="text-sm text-muted-foreground">
            The host keeps extension route metadata out of this fallback until a server-issued guard
            confirms the caller can inspect it.
          </p>
        </FallbackShell>
      );
    case 'not-found':
      return (
        <FallbackShell
          title="External Route Not Found"
          description="No enabled extension route matches this external path."
          icon={<AlertCircle className="h-5 w-5" />}
          badges={[resolution.pathname, resolution.audit.reason]}
        >
          <p className="text-sm text-muted-foreground">
            External routes must be declared by an installed extension and activated by the host
            registry before Cockpit will render them.
          </p>
        </FallbackShell>
      );
  }
}

function FallbackShell({
  title,
  description,
  icon,
  badges,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  badges: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title={title} description={description} />

      <Card className="shadow-none">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            Host Fallback
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <Badge key={badge} variant="outline">
                {badge}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <Button asChild variant="outline" size="sm">
            <Link to="/explore/extensions">View extension registry</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
