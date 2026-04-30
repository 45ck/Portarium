import { Link } from '@tanstack/react-router';
import { AlertCircle, LockKeyhole, PlugZap } from 'lucide-react';
import { Suspense } from 'react';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import {
  INSTALLED_COCKPIT_EXTENSIONS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
} from '@/lib/extensions/installed';
import { resolveCockpitExtensionRegistry } from '@/lib/extensions/registry';
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
  const registry = resolveCockpitExtensionRegistry({
    installedExtensions: INSTALLED_COCKPIT_EXTENSIONS,
    activePackIds: serverAccess.activePackIds,
    quarantinedExtensionIds: serverAccess.quarantinedExtensionIds,
    availableCapabilities: serverAccess.accessContext.availableCapabilities,
    availableApiScopes: serverAccess.accessContext.availableApiScopes,
    routeLoaders: INSTALLED_COCKPIT_ROUTE_LOADERS,
  });
  const resolution = resolveExternalRoute({
    pathname,
    ...serverAccess.accessContext,
    persona: activePersona,
    registry,
    components: HOSTED_EXTERNAL_ROUTE_COMPONENTS,
  });

  if (resolution.kind === 'active' && resolution.component) {
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

function ExternalRouteFallback({ resolution }: { resolution: ExternalRouteResolution }) {
  switch (resolution.kind) {
    case 'active':
      return (
        <FallbackShell
          title={resolution.route.title}
          description="This extension route is active, but this Cockpit build does not include a host-owned renderer for it."
          icon={<PlugZap className="h-5 w-5" />}
          badges={[
            resolution.extension.manifest.displayName,
            resolution.route.id,
            'renderer missing',
          ]}
        >
          <RouteContract resolution={resolution} />
        </FallbackShell>
      );
    case 'forbidden':
      return (
        <FallbackShell
          title="Extension Route Restricted"
          description="This route is not available for the active Cockpit persona."
          icon={<LockKeyhole className="h-5 w-5" />}
          badges={['restricted']}
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
          badges={[resolution.pathname]}
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
  icon: React.ReactNode;
  badges: readonly string[];
  children: React.ReactNode;
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

function RouteContract({
  resolution,
}: {
  resolution: Extract<ExternalRouteResolution, { route: unknown }>;
}) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      <ContractItem label="Path" value={resolution.route.path} />
      <ContractItem label="Extension" value={resolution.extension.manifest.id} />
      <ContractItem
        label="Personas"
        value={
          resolution.route.guard.personas.length > 0
            ? resolution.route.guard.personas.join(', ')
            : 'None'
        }
      />
      <ContractItem
        label="Capabilities"
        value={
          resolution.route.guard.requiredCapabilities.length > 0
            ? resolution.route.guard.requiredCapabilities.join(', ')
            : 'None'
        }
      />
      <ContractItem
        label="API scopes"
        value={
          resolution.route.guard.requiredApiScopes.length > 0
            ? resolution.route.guard.requiredApiScopes.join(', ')
            : 'None'
        }
      />
      <ContractItem
        label="Params"
        value={formatParams('params' in resolution ? resolution.params : {})}
      />
    </div>
  );
}

function ContractItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-mono text-xs text-foreground">{value}</p>
    </div>
  );
}

function formatParams(params: Readonly<Record<string, string>>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return 'None';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}
