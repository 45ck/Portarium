import { createRoute } from '@tanstack/react-router';
import { Boxes, CheckCircle2, ExternalLink, LockKeyhole, Route as RouteIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Route as rootRoute } from '../__root';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCockpitExtensionContext } from '@/hooks/queries/use-cockpit-extension-context';
import { resolveCockpitExtensionServerAccess } from '@/lib/extensions/access-context';
import { resolveInstalledCockpitExtensionRegistry } from '@/lib/extensions/installed';
import type { ResolvedCockpitExtension } from '@/lib/extensions/types';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

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
    availableCapabilities: serverAccess.accessContext.availableCapabilities,
    availableApiScopes: serverAccess.accessContext.availableApiScopes,
    availablePrivacyClasses: serverAccess.accessContext.availablePrivacyClasses,
  });
  const statusCounts = getExtensionStatusCounts(registry.extensions);

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
        <StatusSummaryCard label="Invalid" value={statusCounts.invalid} />
      </div>

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
              Extension UI calls Portarium APIs or declared external APIs; it does not call systems
              of record directly.
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
      meta: problem.message,
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
      <CardContent className="grid gap-4 lg:grid-cols-3">
        {isEnabled ? (
          <ExtensionSection
            title="Routes"
            icon={<RouteIcon className="h-4 w-4" />}
            items={manifest.routes.map((route) => ({
              key: route.id,
              label: route.title,
              meta: route.path,
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
        <ExtensionSection
          title="Capabilities"
          icon={<CheckCircle2 className="h-4 w-4" />}
          items={manifest.requiredCapabilities.map((capability) => ({
            key: capability,
            label: capability,
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

function ExtensionSection({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: readonly { key: string; label: string; meta?: string }[];
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
            <p className="text-sm font-medium">{item.label}</p>
            {item.meta ? <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
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
    invalid: extensions.filter((extension) => extension.status === 'invalid').length,
  };
}

function getStatusBadgeVariant(status: ResolvedCockpitExtension['status']) {
  if (status === 'enabled') return 'success';
  if (status === 'invalid' || status === 'quarantined') return 'destructive';
  return 'secondary';
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/extensions',
  component: ExtensionsPage,
});
