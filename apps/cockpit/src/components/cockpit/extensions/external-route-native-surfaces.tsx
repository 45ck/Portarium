import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  hasCockpitNativeRouteSurface as hasNativeRouteSurface,
  isCockpitNativeRouteSurface as isNativeRouteSurface,
  type CockpitNativeAutomationProposal as NativeAutomationProposal,
  type CockpitNativeBaseMap as NativeBaseMap,
  type CockpitNativeDataExplorerInsight as NativeDataExplorerInsight,
  type CockpitNativeDataExplorerMetric as NativeDataExplorerMetric,
  type CockpitNativeDataExplorerSource as NativeDataExplorerSource,
  type CockpitNativeDataExplorerSurface as NativeDataExplorerSurface,
  type CockpitNativeGovernedActionReviewSurface as NativeGovernedActionReviewSurface,
  type CockpitNativeKeyValue as NativeKeyValue,
  type CockpitNativeLinkAction as NativeLinkAction,
  type CockpitNativeMapEntity as NativeMapEntity,
  type CockpitNativeMapLayer as NativeMapLayer,
  type CockpitNativeMapWorkbenchSurface as NativeMapWorkbenchSurface,
  type CockpitNativeReadOnlyGroup as NativeReadOnlyGroup,
  type CockpitNativeRelatedItem as NativeRelatedItem,
  type CockpitNativeRouteSurfaceBase as NativeRouteSurfaceBase,
  type CockpitNativeRouteSurfaceData as NativeRouteSurfaceData,
  type CockpitNativeSelectOption as NativeSelectOption,
  type CockpitNativeSnapshotPort as NativeSnapshotPort,
  type CockpitNativeSnapshotRecommendation as NativeSnapshotRecommendation,
  type CockpitNativeSourcePostureSummary as NativeSourcePostureSummary,
  type CockpitNativeStatusBadge as NativeStatusBadge,
  type CockpitNativeTicketConversationBlock as NativeTicketConversationBlock,
  type CockpitNativeTicketConversationItem as NativeTicketConversationItem,
  type CockpitNativeTicketDetail as NativeTicketDetail,
  type CockpitNativeTicketDetailSection as NativeTicketDetailSection,
  type CockpitNativeTicketFilterGroup as NativeTicketFilterGroup,
  type CockpitNativeTicketFilterOption as NativeTicketFilterOption,
  type CockpitNativeTicketInboxSurface as NativeTicketInboxSurface,
  type CockpitNativeTicketRecord as NativeTicketRecord,
  type CockpitNativeTicketSectionContent as NativeTicketSectionContent,
  type CockpitNativeTicketView as NativeTicketView,
} from '@portarium/cockpit-extension-sdk';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Database,
  FileText,
  Lightbulb,
  Loader2,
  Map,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { MapWorkbenchShell } from '@/components/cockpit/map-host/map-workbench-shell';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ResolvedCockpitExtension } from '@/lib/extensions/types';
import { useProposeAgentAction } from '@/hooks/queries/use-approvals';
import { useUIStore } from '@/stores/ui-store';
import type { ExternalRouteComponentProps } from './external-route-adapter';

export { hasNativeRouteSurface };

export function ExternalRouteNativeSurfaceRenderer({
  data,
  route,
  extension,
}: ExternalRouteComponentProps & { data: NativeRouteSurfaceData }) {
  const surface = data.nativeSurface;
  if (!isNativeRouteSurface(surface)) return null;

  if (surface.kind === 'portarium.native.mapWorkbench.v1') {
    return (
      <NativeMapWorkbenchSurfaceRenderer
        surface={surface}
        extension={extension}
        routeId={route.id}
      />
    );
  }

  if (surface.kind === 'portarium.native.dataExplorer.v1') {
    return (
      <NativeDataExplorerSurfaceRenderer
        surface={surface}
        extension={extension}
        routeId={route.id}
      />
    );
  }

  if (surface.kind === 'portarium.native.governedActionReview.v1') {
    return (
      <NativeGovernedActionReviewSurfaceRenderer
        surface={surface}
        extension={extension}
        routeId={route.id}
      />
    );
  }

  return (
    <NativeTicketInboxSurfaceRenderer surface={surface} extension={extension} routeId={route.id} />
  );
}

function NativeGovernedActionReviewSurfaceRenderer({
  surface,
  extension,
  routeId,
}: {
  surface: NativeGovernedActionReviewSurface;
  extension: ResolvedCockpitExtension;
  routeId: string;
}) {
  return (
    <NativeSurfaceShell surface={surface} extension={extension} routeId={routeId}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Proposal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ReviewKeyValue label="Reference" value={surface.proposal.reference} />
              <ReviewKeyValue label="Review mode" value={surface.proposal.reviewMode} />
              <ReviewKeyValue label="Approval state" value={surface.proposal.approvalState} />
              <ReviewKeyValue label="Minimum tier" value={surface.proposal.minimumExecutionTier} />
              <p className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                {surface.proposal.rationale}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {surface.evidence.referencedEvidenceCount} refs
                </Badge>
                <Badge variant={surface.evidence.sourceBodiesIncluded ? 'warning' : 'success'}>
                  {surface.evidence.sourceBodiesIncluded ? 'Bodies included' : 'Refs only'}
                </Badge>
              </div>
              <div className="grid gap-2">
                {surface.evidence.refs.length > 0 ? (
                  surface.evidence.refs.map((evidence) => (
                    <article key={evidence.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{evidence.id}</p>
                        {evidence.privacyClass ? (
                          <Badge variant="outline">{evidence.privacyClass}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{evidence.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {evidence.sourceSystem} / {evidence.sourceMode} / {evidence.sourceRef}
                      </p>
                    </article>
                  ))
                ) : (
                  <article className="rounded-md border border-dashed p-3">
                    <p className="text-sm font-medium">No proposal evidence refs</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This proposal does not have linked evidence refs in the loaded read model.
                    </p>
                  </article>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Review Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {surface.actions.map((action) => (
                <Button
                  key={action.id}
                  className="h-auto justify-start whitespace-normal"
                  disabled={action.disabled}
                  type="button"
                  variant="outline"
                >
                  <span className="grid gap-1 text-left">
                    <span>{action.label}</span>
                    {action.reason ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {action.reason}
                      </span>
                    ) : null}
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          {surface.roomHealth ? (
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Room Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <strong>{surface.roomHealth.roomCode}</strong>
                  <Badge variant="outline">{surface.roomHealth.status}</Badge>
                </div>
                <p className="text-3xl font-semibold tabular-nums">{surface.roomHealth.score}</p>
                <p className="text-sm text-muted-foreground">{surface.roomHealth.summary}</p>
                {surface.roomHealth.signals && surface.roomHealth.signals.length > 0 ? (
                  <div className="grid gap-2">
                    {surface.roomHealth.signals.slice(0, 4).map((signal) => (
                      <div key={signal.id} className="rounded-md border p-2">
                        <p className="text-xs font-medium">{signal.id}</p>
                        <p className="text-xs text-muted-foreground">{signal.summary}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Connectors
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {(surface.connectors ?? []).map((connector) => (
                <article key={connector.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{connector.name}</p>
                    <Badge variant="outline">{connector.state}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {connector.sourceSystem} / {connector.sourceMode}
                  </p>
                  {connector.message ? (
                    <p className="mt-2 text-xs text-muted-foreground">{connector.message}</p>
                  ) : null}
                </article>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Execution Boundary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <ReviewKeyValue label="Available" value={surface.execution.available ? 'yes' : 'no'} />
              <ReviewKeyValue
                label="Adapter installed"
                value={surface.execution.adapterInstalled ? 'yes' : 'no'}
              />
              <ReviewKeyValue
                label="Writeback"
                value={surface.execution.writebackEnabled ? 'enabled' : 'disabled'}
              />
              <ReviewKeyValue label="Source access" value={surface.execution.sourceSystemAccess} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </NativeSurfaceShell>
  );
}

function NativeDataExplorerSurfaceRenderer({
  surface,
  extension,
  routeId,
}: {
  surface: NativeDataExplorerSurface;
  extension: ResolvedCockpitExtension;
  routeId: string;
}) {
  const sourceGroups = groupDataExplorerSources(surface.explorer.sources);
  const sourceStats = summarizeDataExplorerSources(surface.explorer.sources);

  return (
    <NativeSurfaceShell surface={surface} extension={extension} routeId={routeId}>
      <div className="space-y-5">
        <section aria-label="Data metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {surface.explorer.metrics.map((metric) => (
            <Card key={metric.id} className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-3">
                  <strong className="text-2xl tabular-nums">{metric.value}</strong>
                  {metric.tone ? (
                    <Badge variant={badgeVariant(metric.tone)}>{metric.tone}</Badge>
                  ) : null}
                </div>
                {metric.detail ? (
                  <p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </section>

        <section aria-label="Operational snapshot" className="grid gap-3 lg:grid-cols-4">
          <OperationalSnapshotItem
            icon={<Database className="h-4 w-4" />}
            label="Usable now"
            value={sourceStats.available}
            detail="Static snapshots and local exports"
          />
          <OperationalSnapshotItem
            icon={<FileText className="h-4 w-4" />}
            label="Reference context"
            value={sourceStats.reference}
            detail="Docs, tickets, and runbooks"
          />
          <OperationalSnapshotItem
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Restricted data"
            value={sourceStats.restricted}
            detail="Needs careful read-only handling"
          />
          <OperationalSnapshotItem
            icon={<Network className="h-4 w-4" />}
            label="Projected records"
            value={sourceStats.records}
            detail="Approximate static inventory size"
          />
        </section>

        {surface.explorer.sourcePosture ? (
          <SourcePostureSummaryCard posture={surface.explorer.sourcePosture} />
        ) : null}

        {surface.explorer.snapshotPorts && surface.explorer.snapshotPorts.length > 0 ? (
          <section className="space-y-3" aria-label="Snapshot mock ports">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Snapshot Mock Ports</h2>
                <p className="text-xs text-muted-foreground">
                  Extension-provided read models that can be exercised without source-system access.
                </p>
              </div>
              <Badge variant="outline">No live calls</Badge>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {surface.explorer.snapshotPorts.map((port) => (
                <SnapshotPortCard key={port.id} port={port} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-3" aria-label="Data insights">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Recommended Checks</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {surface.explorer.insights.map((insight) => (
              <Card key={insight.id} className="shadow-none">
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm">{insight.title}</CardTitle>
                    {insight.tone ? (
                      <Badge variant={badgeVariant(insight.tone)}>{insight.tone}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{insight.summary}</p>
                  {insight.sourceIds && insight.sourceIds.length > 0 ? (
                    <p className="text-[11px]">Sources: {insight.sourceIds.join(', ')}</p>
                  ) : null}
                  {insight.href ? (
                    <Button asChild size="xs" variant="outline">
                      <a href={insight.href}>
                        Open context
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-label="Data sources">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Read-Only Data Sources</h2>
              <p className="text-xs text-muted-foreground">
                Operator-facing source status first; technical refs are available when needed.
              </p>
            </div>
            <Badge variant="outline">Host-rendered</Badge>
          </div>
          <div className="space-y-4">
            {sourceGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="text-xs text-muted-foreground">{group.description}</p>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {group.sources.map((source) => (
                    <DataSourceCard key={source.id} source={source} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {surface.explorer.integrationNotes && surface.explorer.integrationNotes.length > 0 ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                Portarium Integration Boundary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              {surface.explorer.integrationNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </NativeSurfaceShell>
  );
}

function groupDataExplorerSources(sources: readonly NativeDataExplorerSource[]) {
  const groups = [
    {
      id: 'available',
      title: 'Available Static Data',
      description: 'Local snapshots and exports that have concrete static records now.',
      predicate: (source: NativeDataExplorerSource) =>
        normalizedDescriptor(source.readiness).includes('static snapshot') ||
        normalizedDescriptor(source.readiness).includes('local static export') ||
        normalizedDescriptor(source.readiness).includes('local export'),
      sources: [] as NativeDataExplorerSource[],
    },
    {
      id: 'reference',
      title: 'Reference And Documentation Context',
      description: 'Docs, ticket indexes, and reference corpora useful for read-only explanation.',
      predicate: (source: NativeDataExplorerSource) =>
        normalizedDescriptor(source.sourceMode).includes('documentation') ||
        normalizedDescriptor(source.category).includes('learning') ||
        normalizedDescriptor(source.category).includes('security'),
      sources: [] as NativeDataExplorerSource[],
    },
    {
      id: 'capability',
      title: 'Capabilities And Candidates',
      description: 'Package capabilities or future adapters that should not be read as live data.',
      predicate: (source: NativeDataExplorerSource) =>
        normalizedDescriptor(source.readiness).includes('capability') ||
        normalizedDescriptor(source.readiness).includes('candidate') ||
        normalizedDescriptor(source.readiness).includes('reference fixture'),
      sources: [] as NativeDataExplorerSource[],
    },
  ];

  for (const source of sources) {
    const group = groups.find((candidate) => candidate.predicate(source)) ?? groups[0]!;
    group.sources.push(source);
  }

  return groups.filter((group) => group.sources.length > 0);
}

function summarizeDataExplorerSources(sources: readonly NativeDataExplorerSource[]) {
  const records = sources.reduce((total, source) => total + (source.recordCount ?? 0), 0);

  return {
    available: sources.filter((source) =>
      ['static snapshot', 'local static export', 'local export'].some((label) =>
        normalizedDescriptor(source.readiness).includes(label),
      ),
    ).length,
    reference: sources.filter(
      (source) =>
        normalizedDescriptor(source.sourceMode).includes('documentation') ||
        ['docs', 'learning', 'security'].some((category) =>
          normalizedDescriptor(source.category).includes(category),
        ),
    ).length,
    restricted: sources.filter((source) =>
      ['restricted', 'sensitive', 'highly restricted'].includes(
        normalizedDescriptor(source.privacyClass),
      ),
    ).length,
    records: records > 0 ? records.toLocaleString() : 'n/a',
  };
}

function normalizedDescriptor(value: string | undefined): string {
  return value?.replaceAll('_', ' ').toLowerCase() ?? '';
}

function OperationalSnapshotItem({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <strong className="text-lg tabular-nums">{value}</strong>
      </div>
      <p className="mt-2 text-xs font-medium">{label}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ReviewKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function SourcePostureSummaryCard({ posture }: { posture: NativeSourcePostureSummary }) {
  const stats = [
    { label: 'Sources', value: posture.sourceCount },
    { label: 'Read-only', value: posture.readOnlySourceCount },
    { label: 'Local snapshots', value: posture.localSnapshotCount },
    { label: 'Restricted', value: posture.restrictedOrSensitiveCount },
    { label: 'Stale/unknown', value: posture.staleOrUnknownCount },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Source Posture
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {posture.dataOrigin ?? 'Extension supplied read model'}
              {posture.generatedAt ? ` · generated ${posture.generatedAt}` : ''}
            </p>
          </div>
          <Badge variant="outline">{posture.sourceSystemAccess ?? 'read-only'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-5">
        {stats.map((stat) => (
          <DataSourceStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </CardContent>
    </Card>
  );
}

function SnapshotPortCard({ port }: { port: NativeSnapshotPort }) {
  const accessLabel = port.sourceSystemAccess ?? 'none';

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="truncate text-sm font-semibold">{port.label}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {port.sourceSystem} · {port.id}
            </p>
          </div>
          <Badge variant={snapshotPortStateVariant(port.state)}>{port.state}</Badge>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <DataSourceStat label="Source access" value={accessLabel} />
          <DataSourceStat label="Writeback" value={port.writebackEnabled ? 'enabled' : 'off'} />
          <DataSourceStat
            label="Payloads"
            value={port.rawPayloadsIncluded || port.credentialsIncluded ? 'restricted' : 'safe'}
          />
        </div>

        {port.mockDataPlane ? (
          <p className="text-sm leading-6 text-muted-foreground">{port.mockDataPlane}</p>
        ) : null}

        {port.livePromotionGate ? (
          <p className="rounded-md border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground">
            Live gate: {port.livePromotionGate}
          </p>
        ) : null}

        <TagList title="Capabilities" items={port.capabilityIds ?? []} />
      </CardContent>
    </Card>
  );
}

function DataSourceCard({ source }: { source: NativeDataExplorerSource }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.55fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h4 className="truncate text-sm font-semibold">{source.label}</h4>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {source.sourceSystem} · {source.sourceMode}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {source.category ? <Badge variant="secondary">{source.category}</Badge> : null}
              {source.readiness ? <Badge variant="outline">{source.readiness}</Badge> : null}
              {source.freshness ? <Badge variant="outline">{source.freshness}</Badge> : null}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">{source.summary}</p>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <DataSourceStat label="Items" value={source.itemCount} />
              <DataSourceStat label="Records" value={source.recordCount} />
              <DataSourceStat label="Privacy" value={source.privacyClass} />
            </div>
            <TagList title="Use for" items={source.visualisations ?? []} />
          </div>

          <div className="flex items-start justify-end">
            {source.href ? (
              <Button asChild size="xs" variant="outline">
                <a href={source.href}>
                  Open
                  <ArrowRight className="h-3 w-3" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <details className="mt-3 border-t pt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Technical evidence and routing
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TagList title="Can answer" items={source.answerableQuestions ?? []} />
            <TagList title="Surfaces" items={source.portariumSurfaces ?? []} />
            <TagList title="Capabilities" items={source.capabilityIds ?? []} />
            <TagList title="Connectors" items={source.connectorIds ?? []} />
            <SourceRefList refs={source.sourceRefs ?? []} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function DataSourceStat({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? 'n/a'}</p>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((item) => (
          <Badge
            key={item}
            variant="outline"
            className="h-auto max-w-full justify-start whitespace-normal break-words text-left leading-4"
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SourceRefList({ refs }: { refs: readonly string[] }) {
  if (refs.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">Source refs</p>
      <div className="grid gap-1">
        {refs.slice(0, 5).map((ref) => (
          <code
            key={ref}
            className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] break-all text-muted-foreground"
          >
            {ref}
          </code>
        ))}
        {refs.length > 5 ? (
          <p className="text-[11px] text-muted-foreground">+{refs.length - 5} more refs</p>
        ) : null}
      </div>
    </div>
  );
}

function NativeTicketInboxSurfaceRenderer({
  surface,
  extension,
  routeId,
}: {
  surface: NativeTicketInboxSurface;
  extension: ResolvedCockpitExtension;
  routeId: string;
}) {
  const selectedTicket = surface.queue.tickets.find((ticket) => ticket.selected);

  return (
    <NativeSurfaceShell surface={surface} extension={extension} routeId={routeId}>
      <Card className="gap-0 py-0 shadow-none">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TicketViews views={surface.queue.views} />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{surface.queue.statusText}</span>
              <span>{surface.queue.pageText}</span>
              <Badge variant="outline">Host-rendered</Badge>
            </div>
          </div>
          <TicketSearch search={surface.queue.search} />
          <TicketFilters filters={surface.queue.filters} />
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              <TicketQueuePanel tickets={surface.queue.tickets} selectedTicket={selectedTicket} />
            </div>
            <TicketDetail detail={surface.selectedTicket} />
          </div>
          <TicketPagination actions={surface.queue.pagination} />
        </CardContent>
      </Card>
    </NativeSurfaceShell>
  );
}

function TicketViews({ views }: { views: readonly NativeTicketView[] }) {
  return (
    <nav aria-label="Ticket views" className="flex flex-wrap gap-1.5">
      {views.map((view) => (
        <Button
          key={view.id}
          asChild
          size="sm"
          variant={view.active ? 'default' : 'outline'}
          className="h-8 justify-between gap-2 px-2.5"
        >
          <a href={view.href} aria-current={view.active ? 'true' : undefined}>
            <span>{view.label}</span>
            <span className="tabular-nums">{view.count}</span>
          </a>
        </Button>
      ))}
    </nav>
  );
}

function TicketSearch({ search }: { search: NativeTicketInboxSurface['queue']['search'] }) {
  return (
    <form
      action={search.action}
      method="get"
      role="search"
      className="rounded-md border bg-muted/10 p-2"
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_150px_96px_auto_auto]">
        <div>
          <Label htmlFor="external-ticket-search" className="sr-only">
            Search
          </Label>
          <Input
            id="external-ticket-search"
            name="q"
            type="search"
            defaultValue={search.query ?? ''}
            placeholder="Ticket ID, subject, requester, room"
            className="h-9"
          />
        </div>
        <NativeSelect
          name="sort"
          label="Sort"
          value={search.sort}
          options={search.sortOptions}
          labelClassName="sr-only"
        />
        <NativeSelect
          name="pageSize"
          label="Rows"
          value={String(search.pageSize)}
          labelClassName="sr-only"
          options={search.pageSizeOptions.map((size) => ({
            value: String(size),
            label: String(size),
          }))}
        />
        <div>
          <Button type="submit" className="h-9 w-full">
            Apply
          </Button>
        </div>
        <div>
          <Button asChild type="button" variant="outline" className="h-9 w-full">
            <a href={search.action}>Clear</a>
          </Button>
        </div>
      </div>
    </form>
  );
}

function NativeSelect({
  name,
  label,
  value,
  options,
  labelClassName,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly NativeSelectOption[];
  labelClassName?: string;
}) {
  return (
    <div>
      <Label className={cn('text-xs', labelClassName)}>{label}</Label>
      <Select name={name} defaultValue={value}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TicketFilters({ filters }: { filters: readonly NativeTicketFilterGroup[] }) {
  return (
    <details className="rounded-md border bg-muted/10 px-3 py-1.5">
      <summary className="cursor-pointer text-xs font-medium">Filters</summary>
      <section aria-label="Ticket filters" className="mt-2 space-y-2">
        {filters.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-xs font-medium text-muted-foreground">{group.label}</span>
            {group.options.map((option) => (
              <Badge
                key={`${group.label}-${option.label}`}
                asChild
                variant={option.active ? 'default' : 'outline'}
              >
                <a href={option.href} aria-current={option.active ? 'true' : undefined}>
                  {option.label}
                </a>
              </Badge>
            ))}
          </div>
        ))}
      </section>
    </details>
  );
}

function TicketQueueDrawer({
  tickets,
  selectedTicket,
}: {
  tickets: readonly NativeTicketRecord[];
  selectedTicket?: NativeTicketRecord;
}) {
  return (
    <details className="rounded-md border bg-muted/10 xl:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Ticket queue</span>
          <span className="block truncate text-xs text-muted-foreground">
            {selectedTicket
              ? `${selectedTicket.label} selected · ${selectedTicket.summary}`
              : 'Open the queue to select a ticket'}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{tickets.length} visible</span>
      </summary>
      <div className="border-t p-2">
        <TicketQueueList tickets={tickets} />
      </div>
    </details>
  );
}

function TicketQueuePanel({
  tickets,
  selectedTicket,
}: {
  tickets: readonly NativeTicketRecord[];
  selectedTicket?: NativeTicketRecord;
}) {
  return (
    <>
      <TicketQueueDrawer tickets={tickets} selectedTicket={selectedTicket} />
      <div className="hidden xl:block">
        <TicketQueueList tickets={tickets} />
      </div>
    </>
  );
}

function TicketQueueList({ tickets }: { tickets: readonly NativeTicketRecord[] }) {
  if (tickets.length === 0) {
    return (
      <section
        aria-label="Queue list"
        className="rounded-md border p-4 text-sm text-muted-foreground"
      >
        No matching tickets.
      </section>
    );
  }

  return (
    <section aria-label="Queue list" className="overflow-hidden rounded-md border bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Ticket List</h2>
        <span className="text-xs text-muted-foreground">{tickets.length} visible</span>
      </header>
      <div className="max-h-[360px] overflow-y-auto divide-y overscroll-contain">
        {tickets.map((ticket) => (
          <a
            key={ticket.id}
            href={ticket.href}
            aria-current={ticket.selected ? 'true' : undefined}
            aria-controls="ticket-reader"
            aria-label={
              ticket.selected ? `Selected ticket ${ticket.label}` : `Select ticket ${ticket.label}`
            }
            className={cn(
              'grid min-w-0 max-w-full gap-2 overflow-hidden border-l-2 px-3 py-3 text-sm transition-colors hover:bg-accent/60',
              ticket.selected
                ? 'border-l-primary bg-accent text-accent-foreground'
                : 'border-l-transparent',
            )}
          >
            <span className="flex min-w-0 items-start justify-between gap-3">
              <span className="min-w-0">
                <strong className="block truncate">{ticket.label}</strong>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                  {ticket.summary}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={ticket.lifecycle === 'open' ? 'info' : 'outline'}>
                  {ticket.statusLabel}
                </Badge>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {ticket.priorityLabel}
                </span>
              </span>
            </span>
            <span className="grid min-w-0 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
              <span className="min-w-0 break-words">
                {ticket.typeLabel ?? 'Unspecified'} · {ticket.category ?? 'Uncategorised'}
              </span>
              <span className="min-w-0 break-words">
                {ticket.updatedAtLabel}
                {ticket.dueLabel ? ` · ${ticket.dueLabel}` : ''}
              </span>
              <span className="min-w-0 break-words">{ticket.requesterLabel ?? 'Requester unknown'}</span>
              <span className="min-w-0 break-words">{ticket.ownerLabel ?? 'No responder'}</span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-[11px]">
              <span className="min-w-0 max-w-full rounded-sm bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                {ticket.roomLabel ?? 'No room hint'}
              </span>
              <code className="min-w-0 max-w-full truncate text-muted-foreground">
                {ticket.sourceRef}
              </code>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function TicketDetail({ detail }: { detail?: NativeTicketDetail }) {
  if (!detail) {
    return (
      <section
        id="ticket-reader"
        aria-label="Ticket reader"
        className="rounded-md border p-4 text-sm text-muted-foreground"
      >
        No ticket selected.
      </section>
    );
  }

  return (
    <section
      id="ticket-reader"
      aria-label="Ticket reader"
      className="rounded-md border bg-background"
    >
      <header className="border-b bg-muted/15 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Selected Ticket</p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold">{detail.label}</h2>
              <StatusBadges badges={detail.badges} />
            </div>
            <code className="block text-[11px] break-all text-muted-foreground">
              {detail.sourceRef}
            </code>
          </div>
          <Badge variant="outline">Read-only</Badge>
        </div>
      </header>

      <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4 p-4">
          <section className="rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">Subject / Summary</p>
            <p className="mt-2 text-sm leading-6">{detail.summary}</p>
          </section>

          {detail.sections && detail.sections.length > 0 ? (
            <TicketDetailSections sections={detail.sections} activeSection={detail.activeSection} />
          ) : null}

          {detail.sectionContent ? (
            <TicketSectionContent detail={detail} content={detail.sectionContent} />
          ) : (
            <>
              <TicketConversationPanel conversation={detail.conversation} />
              <TicketRelatedContext detail={detail} />
            </>
          )}

          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Diagnostics</summary>
            <div className="mt-3">
              <KeyValueList items={detail.diagnostics} />
            </div>
          </details>
        </div>

        <aside className="border-t bg-muted/10 p-4 2xl:border-t-0 2xl:border-l">
          <KeyValueSection title="Ticket fields" items={detail.properties} />
        </aside>
      </div>
    </section>
  );
}

function TicketDetailSections({
  sections,
  activeSection,
}: {
  sections: readonly NativeTicketDetailSection[];
  activeSection?: string;
}) {
  return (
    <nav aria-label="Selected ticket sections" className="grid gap-2 sm:grid-cols-4">
      {sections.map((section) => {
        const active = section.active || section.id === activeSection;
        return (
          <Button
            key={section.id}
            asChild
            size="sm"
            variant={active ? 'default' : 'outline'}
            className="justify-start"
          >
            <a href={section.href} aria-current={active ? 'page' : undefined}>
              {section.label}
            </a>
          </Button>
        );
      })}
    </nav>
  );
}

function TicketSectionContent({
  detail,
  content,
}: {
  detail: NativeTicketDetail;
  content: NativeTicketSectionContent;
}) {
  if (content.kind === 'evidence') {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{content.title ?? 'Evidence'}</h3>
        <RelatedItems
          items={content.items ?? []}
          emptyText={content.emptyText ?? 'No extra context matched this ticket.'}
        />
      </section>
    );
  }

  if (content.kind === 'room') {
    const links = content.roomLinks ?? detail.relatedContext.roomLinks ?? [];

    return (
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{content.title ?? 'Room Context'}</h3>
          {content.evidenceCount !== undefined ? (
            <Badge variant="outline">{content.evidenceCount} evidence refs</Badge>
          ) : null}
        </div>
        {links.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Button key={link.href} asChild size="xs" variant="outline">
                <a href={link.href}>{link.label}</a>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {content.emptyText ?? 'No room-level context matched this ticket.'}
          </p>
        )}
      </section>
    );
  }

  if (content.kind === 'source') {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{content.title ?? 'Source Posture'}</h3>
        <KeyValueList items={content.properties ?? detail.properties} />
      </section>
    );
  }

  return (
    <TicketConversationPanel
      conversation={{
        title: content.title ?? detail.conversation.title,
        message: content.message ?? detail.conversation.message,
        summary: content.summary ?? detail.conversation.summary,
        items: content.items ?? detail.conversation.items,
        totalCount: content.totalCount ?? detail.conversation.totalCount,
        omittedCount: detail.conversation.omittedCount,
      }}
    />
  );
}

function TicketRelatedContext({ detail }: { detail: NativeTicketDetail }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Related Context</h3>
        {detail.relatedContext.roomLinks && detail.relatedContext.roomLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {detail.relatedContext.roomLinks.map((link) => (
              <Button key={link.href} asChild size="xs" variant="outline">
                <a href={link.href}>{link.label}</a>
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <RelatedItems
        items={detail.relatedContext.items}
        emptyText="No extra redacted context item matched this ticket."
      />
    </section>
  );
}

function TicketConversationPanel({
  conversation,
}: {
  conversation: NativeTicketDetail['conversation'];
}) {
  const items = conversation.items ?? [];
  const visibleItems = items.slice(0, 3);
  const remainingItems = items.slice(3);
  const totalCount = conversation.totalCount ?? items.length;
  const hiddenByRouteCount = conversation.omittedCount ?? Math.max(0, totalCount - items.length);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Activity</h3>
      <div className="rounded-md border">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">{conversation.title}</p>
          {conversation.summary ? (
            <p className="mt-1 text-xs text-muted-foreground">{conversation.summary}</p>
          ) : null}
        </div>
        <div className="space-y-3 px-3 py-3">
          {items.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                Showing newest {items.length} of {totalCount} entries.
                {hiddenByRouteCount > 0
                  ? ` ${hiddenByRouteCount} older entries are not loaded in this view.`
                  : ''}
              </p>
              {visibleItems.map((item, index) => (
                <TicketConversationEntry key={item.id} item={item} defaultOpen={index === 0} />
              ))}
              {remainingItems.length > 0 ? (
                <details className="rounded-md border bg-muted/10">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                    Show {remainingItems.length} older entries
                  </summary>
                  <div className="space-y-3 border-t p-3">
                    {remainingItems.map((item) => (
                      <TicketConversationEntry key={item.id} item={item} />
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : (
            <div className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground"
              />
              <div className="min-w-0">
                <p className="text-sm leading-6">{conversation.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Conversation bodies are shown here when an extension provides a governed read-only
                  activity snapshot.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TicketConversationEntry({
  item,
  defaultOpen = false,
}: {
  item: NativeTicketConversationItem;
  defaultOpen?: boolean;
}) {
  return (
    <article className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'mt-3 h-2 w-2 shrink-0 rounded-full',
          item.direction === 'incoming' ? 'bg-info' : 'bg-primary',
        )}
      />
      <details className="min-w-0 flex-1 rounded-md border bg-muted/10" open={defaultOpen}>
        <summary className="cursor-pointer list-none px-3 py-2 marker:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">{item.authorLabel ?? 'Freshservice user'}</p>
            {item.timestampLabel ? (
              <time className="text-[11px] text-muted-foreground">{item.timestampLabel}</time>
            ) : null}
          </div>
          {item.bodyPreview ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {item.bodyPreview}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.bodyFormat && item.bodyFormat !== 'plain' ? (
              <Badge variant="outline">{item.bodyFormat}</Badge>
            ) : null}
            {item.private ? <Badge variant="outline">Private</Badge> : null}
            {item.metadata ? (
              <span className="text-[11px] text-muted-foreground">{item.metadata}</span>
            ) : null}
          </div>
        </summary>
        <div className="border-t px-3 py-3">
          <ConversationBody body={item.body} blocks={item.bodyBlocks} />
        </div>
      </details>
    </article>
  );
}

function ConversationBody({
  body,
  blocks: providedBlocks,
}: {
  body: string;
  blocks?: readonly NativeTicketConversationBlock[];
}) {
  const blocks =
    providedBlocks && providedBlocks.length > 0 ? providedBlocks : conversationBlocks(body);

  return (
    <div className="space-y-2 text-sm leading-6">
      {blocks.map((block, index) => {
        if (block.kind === 'quote') {
          return (
            <blockquote
              key={`${block.kind}-${index}`}
              className="border-l-2 pl-3 text-muted-foreground"
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.kind === 'list') {
          return (
            <ul key={`${block.kind}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${block.kind}-${index}`}>{block.text}</p>;
      })}
    </div>
  );
}

function conversationBlocks(body: string): NativeTicketConversationBlock[] {
  const blocks: NativeTicketConversationBlock[] = [];
  const paragraphs = body
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 0 && lines.every((line) => /^[-*+]\s+/.test(line))) {
      blocks.push({ kind: 'list', items: lines.map((line) => line.replace(/^[-*+]\s+/, '')) });
      continue;
    }

    if (lines.length > 0 && lines.every((line) => /^>\s?/.test(line))) {
      blocks.push({
        kind: 'quote',
        text: lines.map((line) => line.replace(/^>\s?/, '')).join(' '),
      });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: lines.join(' ') });
  }

  return blocks.length > 0 ? blocks : [{ kind: 'paragraph', text: body }];
}

function TicketPagination({ actions }: { actions: readonly NativeLinkAction[] }) {
  return (
    <nav aria-label="Ticket pagination" className="flex flex-wrap justify-end gap-2">
      {actions.map((action) => (
        <Button
          key={`${action.label}-${action.href}`}
          asChild={!action.disabled}
          size="sm"
          variant={action.active ? 'default' : 'outline'}
          disabled={action.disabled}
        >
          {action.disabled ? <span>{action.label}</span> : <a href={action.href}>{action.label}</a>}
        </Button>
      ))}
    </nav>
  );
}

function NativeMapWorkbenchSurfaceRenderer({
  surface,
  extension,
  routeId,
}: {
  surface: NativeMapWorkbenchSurface;
  extension: ResolvedCockpitExtension;
  routeId: string;
}) {
  const [activeTab, setActiveTab] = useState(surface.map.activeTab);
  const [activeBaseMapId, setActiveBaseMapId] = useState(surface.map.activeBaseMapId);
  const activeBaseMap = useMemo(
    () => surface.map.baseMaps.find((baseMap) => baseMap.id === activeBaseMapId),
    [activeBaseMapId, surface.map.baseMaps],
  );

  return (
    <NativeSurfaceShell surface={surface} extension={extension} routeId={routeId}>
      <div className="h-[calc(100vh-13rem)] min-h-[560px] overflow-hidden rounded-md border">
        <MapWorkbenchShell
          title={surface.title}
          subtitle={surface.description ?? extension.manifest.description}
          dataState="ready"
          tabs={surface.map.tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectionLabel={surface.map.selectionLabel}
          status={<Badge variant="outline">{surface.map.mode}</Badge>}
          toolbar={
            <div className="flex flex-wrap gap-2 rounded-md border bg-background/95 p-2 shadow-sm">
              {surface.map.baseMaps.map((baseMap) => (
                <Button
                  key={baseMap.id}
                  type="button"
                  size="xs"
                  variant={baseMap.id === activeBaseMapId ? 'default' : 'outline'}
                  onClick={() => setActiveBaseMapId(baseMap.id)}
                >
                  {baseMap.label}
                </Button>
              ))}
            </div>
          }
          map={
            <NativeMapCanvas
              activeBaseMap={activeBaseMap}
              layers={surface.map.layers}
              entities={surface.map.entities}
            />
          }
          readOnlyItemGroups={surface.map.readOnlyGroups.map((group) => ({
            id: group.id,
            label: group.label,
            description: group.description,
            privacyClass: 'internal' as const,
            freshness: { state: 'cached' as const, label: 'Local read model' },
            items: group.items.map((item) => ({
              id: item.id,
              label: item.label,
              kind: 'external-context',
              summary: item.summary,
              privacyClass: 'internal' as const,
              freshness: { state: 'cached' as const, label: item.metadata ?? 'Snapshot' },
            })),
          }))}
          layers={surface.map.layers.map((layer) => ({
            id: layer.id,
            label: layer.label,
            enabled: layer.enabled,
            kind: layer.kind,
            privacyClass: 'internal' as const,
            freshness: { state: 'cached' as const, label: layer.freshnessLabel ?? 'Snapshot' },
            payload: layer,
          }))}
          entities={surface.map.entities.map((entity) => ({
            id: entity.id,
            kind: entity.kind,
            label: entity.label,
            status:
              entity.status === 'critical' || entity.status === 'warning'
                ? entity.status
                : 'normal',
            privacyClass: 'internal' as const,
            freshness: { state: 'cached' as const, label: 'Snapshot' },
            payload: entity,
          }))}
        />
      </div>
    </NativeSurfaceShell>
  );
}

function NativeMapCanvas({
  activeBaseMap,
  layers,
  entities,
}: {
  activeBaseMap?: NativeBaseMap;
  layers: readonly NativeMapLayer[];
  entities: readonly NativeMapEntity[];
}) {
  const svgHostRef = useRef<HTMLDivElement | null>(null);
  const sanitizedSvgSource = useMemo(
    () => sanitizeInlineSvgSource(activeBaseMap?.svgSource),
    [activeBaseMap?.svgSource],
  );
  const resolveRoomEntity = useCallback(
    (roomRef: string | null | undefined) =>
      roomRef ? resolveMapEntityForRoomRef(roomRef, entities) : undefined,
    [entities],
  );

  useEffect(() => {
    const svgHost = svgHostRef.current;
    if (!svgHost || sanitizedSvgSource.length === 0) return;

    svgHost.querySelectorAll<SVGElement>('[data-room]').forEach((element) => {
      const entity = resolveRoomEntity(element.getAttribute('data-room'));
      if (!entity) return;
      const href = safeNativeSurfacePath(entity.href);
      if (!href) return;

      element.setAttribute('role', 'link');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', `Open ${entity.label}`);
      element.style.cursor = 'pointer';
    });
  }, [resolveRoomEntity, sanitizedSvgSource]);

  const openRoomFromTarget = useCallback(
    (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      const roomElement = target.closest<SVGElement>('[data-room]');
      const entity = resolveRoomEntity(roomElement?.getAttribute('data-room'));
      const href = safeNativeSurfacePath(entity?.href);
      if (!href) return false;

      window.location.assign(href);
      return true;
    },
    [resolveRoomEntity],
  );

  const handleSvgClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      openRoomFromTarget(event.target);
    },
    [openRoomFromTarget],
  );

  const handleSvgKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (openRoomFromTarget(event.target)) {
        event.preventDefault();
      }
    },
    [openRoomFromTarget],
  );

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden bg-muted">
      <div
        className={cn(
          'absolute inset-0',
          activeBaseMap?.kind === 'provider'
            ? 'bg-[linear-gradient(135deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(225deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(315deg,hsl(var(--muted))_25%,hsl(var(--background))_25%)] bg-[length:24px_24px] bg-[position:12px_0,12px_0,0_0,0_0]'
            : 'bg-background',
        )}
      />
      <div className="absolute inset-6 rounded-xl border border-border bg-card/70 shadow-inner">
        {sanitizedSvgSource.length > 0 ? (
          <div
            ref={svgHostRef}
            className="h-full w-full overflow-hidden p-4 [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-full"
            onClick={handleSvgClick}
            onKeyDown={handleSvgKeyDown}
            // The SVG is supplied by an installed extension read model and sanitized before render.
            dangerouslySetInnerHTML={{ __html: sanitizedSvgSource }}
          />
        ) : activeBaseMap?.imageHref ? (
          <img
            src={activeBaseMap.imageHref}
            alt={activeBaseMap.imageAlt ?? activeBaseMap.label}
            className="h-full w-full object-contain p-4"
            draggable={false}
          />
        ) : (
          <>
            <div className="absolute inset-x-8 top-1/3 h-px bg-border" />
            <div className="absolute inset-y-8 left-1/3 w-px bg-border" />
            <div className="absolute right-10 bottom-10 left-10 h-24 rounded-lg border border-primary/30 bg-primary/5" />
            <div className="absolute top-10 right-10 h-32 w-44 rounded-lg border border-border bg-background/80" />
          </>
        )}
      </div>
      <div className="absolute top-4 left-4 max-w-sm rounded-md border bg-background/95 p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{activeBaseMap?.label ?? 'Map workbench'}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeBaseMap?.description ??
            'Host map shell supports provider-backed maps and custom indoor/vector maps.'}
        </p>
        {activeBaseMap?.provider ? (
          <Badge className="mt-2" variant="outline">
            {activeBaseMap.provider}
          </Badge>
        ) : null}
      </div>
      <div className="absolute bottom-4 left-4 flex max-w-xl flex-wrap gap-2">
        {layers.map((layer) => (
          <Badge key={layer.id} variant={layer.enabled ? 'secondary' : 'outline'}>
            {layer.label}
          </Badge>
        ))}
      </div>
      <div className="absolute right-4 bottom-4 grid max-w-xs gap-2">
        {entities.slice(0, 4).map((entity) => {
          const href = safeNativeSurfacePath(entity.href);
          const content = (
            <>
              <p className="text-xs font-semibold">{entity.label}</p>
              <p className="text-[11px] text-muted-foreground">
                {entity.kind}
                {entity.locationLabel ? ` · ${entity.locationLabel}` : ''}
              </p>
            </>
          );

          return href ? (
            <a
              key={entity.id}
              href={href}
              className="rounded-md border bg-background/95 px-3 py-2 text-foreground no-underline shadow-sm hover:border-primary/60 hover:bg-background"
            >
              {content}
            </a>
          ) : (
            <div
              key={entity.id}
              className="rounded-md border bg-background/95 px-3 py-2 text-foreground shadow-sm"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function sanitizeInlineSvgSource(svgSource: string | undefined): string {
  if (!svgSource || typeof DOMParser === 'undefined') return '';

  try {
    const document = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
    const root = document.documentElement;
    if (document.querySelector('parsererror') || root.localName.toLowerCase() !== 'svg') return '';

    document
      .querySelectorAll('*')
      .forEach((element) => {
        if (!allowedInlineSvgElementNames.has(element.localName.toLowerCase())) {
          element.remove();
        }
      });
    document.querySelectorAll('*').forEach((element) => {
      for (const attribute of [...element.attributes]) {
        const attributeName = attribute.name.toLowerCase();
        const attributeValue = attribute.value.trim().toLowerCase();
        if (
          attributeName.startsWith('on') ||
          !allowedInlineSvgAttributeNames.has(attributeName) ||
          hasUnsafeInlineSvgAttributeValue(attributeName, attributeValue)
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    });

    return document.documentElement.outerHTML;
  } catch {
    return '';
  }
}

const allowedInlineSvgElementNames = new Set([
  'circle',
  'clippath',
  'defs',
  'desc',
  'ellipse',
  'g',
  'line',
  'lineargradient',
  'path',
  'polygon',
  'polyline',
  'radialgradient',
  'rect',
  'stop',
  'svg',
  'text',
  'title',
  'tspan',
]);

const allowedInlineSvgAttributeNames = new Set([
  'aria-label',
  'class',
  'cx',
  'cy',
  'd',
  'data-room',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'id',
  'offset',
  'opacity',
  'points',
  'preserveaspectratio',
  'r',
  'role',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'style',
  'tabindex',
  'text-anchor',
  'transform',
  'version',
  'viewbox',
  'width',
  'x',
  'x1',
  'x2',
  'xml:space',
  'xmlns',
  'y',
  'y1',
  'y2',
]);

function hasUnsafeInlineSvgAttributeValue(attributeName: string, attributeValue: string): boolean {
  if (
    attributeName === 'style' &&
    (attributeValue.includes('url(') ||
      attributeValue.includes('expression(') ||
      attributeValue.includes('@import'))
  ) {
    return true;
  }

  return /(?:javascript|data|vbscript)\s*:/iu.test(attributeValue);
}

function safeNativeSurfacePath(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmedHref = href.trim();
  if (!trimmedHref.startsWith('/') || trimmedHref.startsWith('//')) return undefined;

  try {
    const parsedUrl = new URL(trimmedHref, 'https://portarium.local');
    if (parsedUrl.origin !== 'https://portarium.local') return undefined;
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return undefined;
  }
}

function resolveMapEntityForRoomRef(
  roomRef: string,
  entities: readonly NativeMapEntity[],
): NativeMapEntity | undefined {
  const normalizedRoomRef = roomRef.trim().toLowerCase();
  return entities.find((entity) =>
    [entity.mapFeatureId, entity.id, entity.label, entity.sourceRef]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase() === normalizedRoomRef),
  );
}

function NativeSurfaceShell({
  surface,
  extension,
  routeId,
  children,
}: {
  surface: NativeRouteSurfaceBase;
  extension: ResolvedCockpitExtension;
  routeId: string;
  children: ReactNode;
}) {
  const automationPanel =
    surface.automationProposals && surface.automationProposals.length > 0 ? (
      <NativeAutomationProposalPanel
        proposals={surface.automationProposals}
        extension={extension}
      />
    ) : null;
  const recommendationPanel =
    surface.snapshotRecommendations && surface.snapshotRecommendations.length > 0 ? (
      <NativeSnapshotRecommendationPanel recommendations={surface.snapshotRecommendations} />
    ) : null;
  const areaNav = surface.area ? (
    <section className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2">
      <div className="mr-1 min-w-fit">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {surface.area.label}
        </p>
        <h2 className="text-sm font-semibold">{surface.area.title}</h2>
      </div>
      <nav
        aria-label={`${surface.area.label} areas`}
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
      >
        {surface.area.navItems.map((item) => (
          <Button
            key={item.id}
            asChild
            size="sm"
            variant={item.active ? 'default' : 'ghost'}
            className="h-auto shrink-0 justify-start px-3 py-2"
          >
            <a href={item.href} aria-current={item.active ? 'page' : undefined}>
              <span className="grid gap-0.5 text-left">
                <span>{item.label}</span>
                {item.detail ? (
                  <span
                    className={cn(
                      'text-[11px] font-normal',
                      item.active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {item.detail}
                  </span>
                ) : null}
              </span>
            </a>
          </Button>
        ))}
      </nav>
      {surface.area.boundary && surface.area.boundary.length > 0 ? (
        <p className="min-w-fit text-xs text-muted-foreground">
          {surface.area.boundary.join(' · ')}
        </p>
      ) : null}
    </section>
  ) : null;

  return (
    <div className={cn('space-y-4', surface.area ? 'px-6 py-4' : 'p-6')}>
      <PageHeader
        title={surface.title}
        description={surface.description ?? extension.manifest.description}
        status={<StatusBadges badges={surface.badges ?? [{ label: routeId, tone: 'neutral' }]} />}
      />
      {areaNav}
      {recommendationPanel}
      {automationPanel}
      {children}
    </div>
  );
}

function NativeSnapshotRecommendationPanel({
  recommendations,
}: {
  recommendations: readonly NativeSnapshotRecommendation[];
}) {
  return (
    <section className="rounded-md border bg-muted/10 px-3 py-3" aria-label="Snapshot recommendations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Snapshot Recommendations</h2>
          <p className="text-xs text-muted-foreground">
            Read-only recommendations from packaged or host-provided read models.
          </p>
        </div>
        <Badge variant="outline">Review only</Badge>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-3">
        {recommendations.map((recommendation) => (
          <Card key={recommendation.id} className="bg-background/80 shadow-none">
            <CardContent className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{recommendation.title}</h3>
                  </div>
                  {recommendation.confidence ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recommendation.confidence}
                    </p>
                  ) : null}
                </div>
                {recommendation.priority ? (
                  <Badge variant="outline">{recommendation.priority}</Badge>
                ) : null}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{recommendation.summary}</p>

              {recommendation.reasons && recommendation.reasons.length > 0 ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {recommendation.reasons.slice(0, 3).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}

              {recommendation.nextHumanStep ? (
                <p className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
                  {recommendation.nextHumanStep}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {recommendation.approvalGate?.minimumExecutionTier ? (
                  <Badge variant="secondary">
                    {recommendation.approvalGate.minimumExecutionTier}
                  </Badge>
                ) : null}
                {recommendation.safety?.sourceSystemAccess ? (
                  <Badge variant="outline">
                    Source access {recommendation.safety.sourceSystemAccess}
                  </Badge>
                ) : null}
                {recommendation.safety?.writebackEnabled === false ? (
                  <Badge variant="outline">No writeback</Badge>
                ) : null}
              </div>

              <SourceRefList refs={recommendation.sourceRefs ?? []} />

              {recommendation.approvalGate?.reviewPath ? (
                <Button asChild size="xs" variant="outline">
                  <a href={recommendation.approvalGate.reviewPath}>
                    Open review
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function NativeAutomationProposalPanel({
  proposals,
  extension,
}: {
  proposals: readonly NativeAutomationProposal[];
  extension: ResolvedCockpitExtension;
}) {
  const { activeWorkspaceId: workspaceId } = useUIStore();
  const proposeAgentAction = useProposeAgentAction(workspaceId);
  const [results, setResults] = useState<
    Record<string, { decision: string; approvalId?: string; proposalId: string }>
  >({});
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  async function handlePropose(proposal: NativeAutomationProposal) {
    setActiveProposalId(proposal.id);
    try {
      const result = await proposeAgentAction.mutateAsync({
        ...proposal.proposal,
        policyIds: [...proposal.proposal.policyIds],
        parameters: {
          extensionId: extension.manifest.id,
          automationId: proposal.id,
          ...(proposal.proposal.parameters ?? {}),
        },
        idempotencyKey:
          proposal.proposal.idempotencyKey ??
          `${extension.manifest.id}:${proposal.id}:${workspaceId}`,
      });
      setResults((current) => ({
        ...current,
        [proposal.id]: {
          decision: result.decision,
          approvalId: result.approvalId,
          proposalId: result.proposalId,
        },
      }));

      if (result.approvalId) {
        toast.success('Approval requested', {
          description: `${proposal.label} is now in the Portarium approval queue.`,
        });
      } else if (result.decision === 'Allow') {
        toast.success('Proposal allowed', {
          description: `${proposal.label} did not require approval.`,
        });
      } else {
        toast.info('Proposal recorded', {
          description: `${proposal.label} returned ${result.decision}.`,
        });
      }
    } catch {
      toast.error('Failed to propose automation', {
        description: 'Portarium did not accept the governed action proposal.',
      });
    } finally {
      setActiveProposalId(null);
    }
  }

  return (
    <details
      className="rounded-md border bg-muted/10 px-3 py-2"
      aria-label="Governed automation proposals"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 marker:hidden">
        <div>
          <h2 className="text-sm font-semibold">Governed Automation Proposals</h2>
          <p className="text-xs text-muted-foreground">
            {proposals.length} extension suggestion{proposals.length === 1 ? '' : 's'} available for
            human-reviewed action.
          </p>
        </div>
        <Badge variant="outline">Approval path</Badge>
      </summary>
      <div className="mt-3 grid gap-2 xl:grid-cols-3">
        {proposals.map((proposal) => {
          const result = results[proposal.id];
          const isSubmitting = proposeAgentAction.isPending && activeProposalId === proposal.id;

          return (
            <Card key={proposal.id} className="bg-background/80 shadow-none">
              <CardContent className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">{proposal.label}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {proposal.proposal.toolName}
                    </p>
                  </div>
                  <Badge variant={badgeVariant(proposal.risk ?? 'neutral')}>
                    {proposal.proposal.executionTier}
                  </Badge>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">{proposal.summary}</p>

                <div className="flex flex-wrap gap-1.5">
                  {proposal.confidence ? (
                    <Badge variant="secondary">{proposal.confidence}</Badge>
                  ) : null}
                  {(proposal.safety ?? []).slice(0, 3).map((item) => (
                    <Badge key={item} variant="outline">
                      {item}
                    </Badge>
                  ))}
                </div>

                <SourceRefList refs={proposal.sourceRefs ?? []} />

                {result ? (
                  <div className="rounded-md border bg-muted/20 p-2 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {result.decision}
                    </div>
                    <p className="mt-1 text-muted-foreground">Proposal {result.proposalId}</p>
                    {result.approvalId ? (
                      <Button asChild size="xs" variant="outline" className="mt-2">
                        <a
                          href={`/approvals?focus=${encodeURIComponent(
                            result.approvalId,
                          )}&from=notification`}
                        >
                          Open approval
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={isSubmitting || !workspaceId}
                  onClick={() => void handlePropose(proposal)}
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Send to approval queue
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </details>
  );
}

function StatusBadges({ badges }: { badges: readonly NativeStatusBadge[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge key={`${badge.label}-${badge.tone ?? 'neutral'}`} variant={badgeVariant(badge.tone)}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function KeyValueSection({ title, items }: { title: string; items: readonly NativeKeyValue[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <KeyValueList items={items} />
    </section>
  );
}

function KeyValueList({ items }: { items: readonly NativeKeyValue[] }) {
  return (
    <dl className="divide-y rounded-md border">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[minmax(96px,0.42fr)_minmax(0,1fr)] sm:gap-3"
        >
          <dt className="min-w-0 break-words text-muted-foreground">{item.label}</dt>
          <dd className="font-medium break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedItems({
  items,
  emptyText,
}: {
  items: readonly NativeRelatedItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-md border p-3">
          <p className="text-sm font-medium">{item.label}</p>
          {item.summary ? (
            <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
          ) : null}
          {item.metadata ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{item.metadata}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function badgeVariant(
  tone: NativeStatusBadge['tone'],
): React.ComponentProps<typeof Badge>['variant'] {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'info') return 'info';
  if (tone === 'critical') return 'destructive';
  return 'outline';
}

function snapshotPortStateVariant(state: string): React.ComponentProps<typeof Badge>['variant'] {
  if (state === 'ready') return 'success';
  if (state === 'planned') return 'info';
  if (state === 'privacy_gated') return 'warning';
  if (state === 'disabled') return 'outline';
  return 'secondary';
}
