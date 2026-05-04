// cspell:words nums
import { createRoute } from '@tanstack/react-router';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  Route as RouteIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import { resolveInstalledCockpitExtensionRegistry } from '@/lib/extensions/installed';
import type {
  CockpitExtensionRegistryProblem,
  ResolvedCockpitExtension,
} from '@/lib/extensions/types';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

type ExtensionContextStatus = 'ready' | 'loading' | 'unavailable' | 'error';

function ExtensionsPage() {
  const activeWorkspaceId = useUIStore((state) => state.activeWorkspaceId);
  const activePersona = useUIStore((state) => state.activePersona);
  const claims = useAuthStore((state) => state.claims);
  const extensionContextQuery = useCockpitExtensionContext(activeWorkspaceId, claims?.sub);
  const serverAccess = resolveCockpitExtensionServerAccess({
    workspaceId: activeWorkspaceId,
    principalId: claims?.sub,
    persona: activePersona,
    serverContext:
      extensionContextQuery.isSuccess && !extensionContextQuery.isFetching
        ? extensionContextQuery.data
        : null,
  });
  const registry = resolveInstalledCockpitExtensionRegistry({
    activePackIds: serverAccess.activePackIds,
    quarantinedExtensionIds: serverAccess.quarantinedExtensionIds,
    emergencyDisabledExtensionIds: serverAccess.emergencyDisabledExtensionIds,
    availableCapabilities: serverAccess.accessContext.availableCapabilities,
    availableApiScopes: serverAccess.accessContext.availableApiScopes,
    availablePrivacyClasses: serverAccess.accessContext.availablePrivacyClasses,
  });
  const statusCounts = getExtensionStatusCounts(registry.extensions);
  const contextStatus: ExtensionContextStatus = extensionContextQuery.isFetching
    ? 'loading'
    : extensionContextQuery.isError
      ? 'error'
      : serverAccess.usable
        ? 'ready'
        : 'unavailable';

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="External Extensions"
        description="Compile-time installed Cockpit extension metadata, workspace activation, and declared capability boundaries"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusSummaryCard label="Installed" value={statusCounts.installed} />
        <StatusSummaryCard label="Enabled" value={statusCounts.enabled} />
        <StatusSummaryCard label="Disabled" value={statusCounts.disabled} />
        <StatusSummaryCard label="Emergency Disabled" value={statusCounts.emergencyDisabled} />
        <StatusSummaryCard label="Quarantined" value={statusCounts.quarantined} />
        <StatusSummaryCard label="Invalid" value={statusCounts.invalid} />
        <ActivationContextCard
          status={contextStatus}
          registryProblemCount={registry.problems.length}
        />
      </div>

      {registry.problems.length > 0 ? <RegistryProblems problems={registry.problems} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {registry.extensions.map((extension) => (
            <ExtensionCard key={extension.manifest.id} extension={extension} />
          ))}
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <LockKeyhole className="h-4 w-4" />
              Host Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Cockpit extensions are installed packages, not remote JavaScript bundles.</p>
            <p>Routes, commands, and navigation declare capabilities before they are surfaced.</p>
            <p>
              Extension UI calls host-mediated Portarium APIs; it does not call systems of record
              directly.
            </p>
            <p>Source snapshots and credentials stay outside Cockpit extension code.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExtensionCard({ extension }: { extension: ResolvedCockpitExtension }) {
  const manifest = extension.manifest;
  const isEnabled = extension.status === 'enabled';
  const statusItems = [
    ...(extension.disableReasons ?? []).map((reason) => ({
      key: reason.code,
      label: reason.code,
      meta: reason.message,
    })),
    ...extension.problems.map((problem) => ({
      key: `${problem.code}-${problem.itemId ?? manifest.id}`,
      label: problem.code,
      meta: formatRegistryProblemMeta(problem),
    })),
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4" />
              {manifest.displayName}
            </CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{manifest.description}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline">installed</Badge>
            <Badge variant={getStatusBadgeVariant(extension.status)}>{extension.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{manifest.id}</Badge>
          <Badge variant="outline">v{manifest.version}</Badge>
          <Badge variant="outline">{manifest.owner}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-4">
        {isEnabled ? (
          <ExtensionSection
            title="Routes"
            icon={<RouteIcon className="h-4 w-4" />}
            items={manifest.routes.map((route) => ({
              key: route.id,
              label: route.title,
              meta: route.path,
              href: getRouteLaunchHref(route.path),
              actionLabel: route.path.includes('$') ? 'Open sample' : 'Open',
            }))}
          />
        ) : (
          <ExtensionSection
            title="Activation"
            icon={<LockKeyhole className="h-4 w-4" />}
            items={manifest.packIds.map((packId) => ({
              key: packId,
              label: packId,
              meta: 'Required workspace pack activation key',
            }))}
          />
        )}
        {isEnabled ? (
          <ExtensionSection
            title="Navigation"
            icon={<ExternalLink className="h-4 w-4" />}
            items={manifest.navItems.map((item) => ({
              key: item.id,
              label: item.title,
              meta: `${item.to} (${item.surfaces.join(', ')})`,
              href: item.to,
              actionLabel: 'Open',
            }))}
          />
        ) : (
          <ExtensionSection
            title="API Scopes"
            icon={<CheckCircle2 className="h-4 w-4" />}
            items={manifest.requiredApiScopes.map((scope) => ({
              key: scope,
              label: scope,
            }))}
          />
        )}
        <ExtensionSection
          title="Permissions"
          icon={<CheckCircle2 className="h-4 w-4" />}
          items={manifest.governance.permissions.map((permission) => ({
            key: permission.id,
            label: permission.title,
            meta: `${permission.kind} - scopes: ${permission.requiredApiScopes.join(', ') || 'none'} - audit: ${permission.auditEventTypes.join(', ')}`,
          }))}
        />
        {isEnabled ? (
          <ExtensionSection
            title="Commands"
            icon={<ExternalLink className="h-4 w-4" />}
            items={manifest.commands.map((command) => ({
              key: command.id,
              label: command.title,
              meta: command.shortcut,
            }))}
          />
        ) : (
          <ExtensionSection
            title="Status"
            icon={<LockKeyhole className="h-4 w-4" />}
            items={
              statusItems.length > 0
                ? statusItems
                : [
                    {
                      key: `${manifest.id}-not-enabled`,
                      label: 'not-enabled',
                      meta: 'No extension routes, navigation, commands, or shortcuts are surfaced.',
                    },
                  ]
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function ActivationContextCard({
  status,
  registryProblemCount,
}: {
  status: ExtensionContextStatus;
  registryProblemCount: number;
}) {
  return (
    <Card aria-label="Activation context" className="shadow-none">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Activation Context</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={status === 'ready' ? 'success' : 'warning'}>activation {status}</Badge>
          <Badge variant={registryProblemCount > 0 ? 'destructive' : 'secondary'}>
            {registryProblemCount} registry problems
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function RegistryProblems({ problems }: { problems: readonly CockpitExtensionRegistryProblem[] }) {
  return (
    <Card className="border-destructive/40 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Registry Problems
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ExtensionSection
          title="Suppressed Surfaces"
          icon={<LockKeyhole className="h-4 w-4" />}
          items={problems.map((problem, index) => ({
            key: `${problem.code}-${problem.extensionId ?? 'registry'}-${problem.itemId ?? index}`,
            label: problem.code,
            meta: formatRegistryProblemMeta(problem),
          }))}
        />
      </CardContent>
    </Card>
  );
}

function ExtensionSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: readonly {
    key: string;
    label: string;
    meta?: string;
    href?: string | null;
    actionLabel?: string;
  }[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="rounded-md border border-border p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                {item.meta ? (
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.meta}</p>
                ) : null}
              </div>
              {item.href ? (
                <Button variant="outline" size="xs" asChild>
                  <a href={item.href} aria-label={`${item.actionLabel ?? 'Open'} ${item.label}`}>
                    <ExternalLink className="h-3 w-3" />
                    {item.actionLabel ?? 'Open'}
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatRegistryProblemMeta(problem: { itemId?: string; message: string }): string {
  return problem.itemId ? `${problem.itemId}: ${problem.message}` : problem.message;
}

function StatusSummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card aria-label={`${label} extensions`} className="shadow-none">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function getExtensionStatusCounts(extensions: readonly ResolvedCockpitExtension[]) {
  return {
    installed: extensions.length,
    enabled: extensions.filter((extension) => extension.status === 'enabled').length,
    disabled: extensions.filter((extension) => extension.status === 'disabled').length,
    emergencyDisabled: extensions.filter((extension) => extension.status === 'emergency-disabled')
      .length,
    quarantined: extensions.filter((extension) => extension.status === 'quarantined').length,
    invalid: extensions.filter((extension) => extension.status === 'invalid').length,
  };
}

function getStatusBadgeVariant(status: ResolvedCockpitExtension['status']) {
  if (status === 'enabled') return 'success';
  if (status === 'invalid' || status === 'quarantined' || status === 'emergency-disabled') {
    return 'destructive';
  }
  return 'secondary';
}

function getRouteLaunchHref(path: string): string | null {
  const segments = path.split('/');
  const launchSegments = segments.map((segment) => {
    if (!segment.startsWith('$')) return segment;
    const parameterName = segment.slice(1);
    return parameterName ? `sample-${parameterName}` : null;
  });

  return launchSegments.every((segment): segment is string => typeof segment === 'string')
    ? launchSegments.join('/')
    : null;
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/extensions',
  component: ExtensionsPage,
});
