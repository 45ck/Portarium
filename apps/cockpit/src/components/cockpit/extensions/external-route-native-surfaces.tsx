import { useMemo, useState, type ReactNode } from 'react';
import { Database, Lightbulb, Map, Network } from 'lucide-react';
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
import type { ExternalRouteComponentProps } from './external-route-adapter';

type NativeSurfaceKind =
  | 'portarium.native.dataExplorer.v1'
  | 'portarium.native.ticketInbox.v1'
  | 'portarium.native.mapWorkbench.v1';

interface NativeRouteSurfaceData {
  nativeSurface?: unknown;
}

interface NativeStatusBadge {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical';
}

interface NativeAreaNavItem {
  id: string;
  label: string;
  href: string;
  detail?: string;
  active?: boolean;
}

interface NativeRouteSurfaceBase {
  kind: NativeSurfaceKind;
  title: string;
  description?: string;
  badges?: readonly NativeStatusBadge[];
  area?: {
    label: string;
    title: string;
    navItems: readonly NativeAreaNavItem[];
    boundary?: readonly string[];
  };
}

interface NativeTicketView {
  id: string;
  label: string;
  count: number;
  href: string;
  active?: boolean;
}

interface NativeTicketFilterOption {
  label: string;
  href: string;
  active?: boolean;
}

interface NativeTicketFilterGroup {
  label: string;
  options: readonly NativeTicketFilterOption[];
}

interface NativeTicketRecord {
  id: string;
  label: string;
  summary: string;
  href: string;
  selected?: boolean;
  statusLabel: string;
  lifecycle?: string;
  priorityLabel: string;
  typeLabel?: string;
  category?: string;
  updatedAtLabel: string;
  dueLabel?: string;
  roomLabel?: string;
  sourceRef: string;
}

interface NativeTicketDetail {
  label: string;
  sourceRef: string;
  summary: string;
  badges: readonly NativeStatusBadge[];
  conversation: {
    title: string;
    message: string;
    summary?: string;
  };
  properties: readonly NativeKeyValue[];
  relatedContext: {
    roomLinks?: readonly { label: string; href: string }[];
    items: readonly NativeRelatedItem[];
  };
  diagnostics: readonly NativeKeyValue[];
}

interface NativeTicketInboxSurface extends NativeRouteSurfaceBase {
  kind: 'portarium.native.ticketInbox.v1';
  queue: {
    views: readonly NativeTicketView[];
    filters: readonly NativeTicketFilterGroup[];
    search: {
      action: string;
      query?: string;
      sort: string;
      pageSize: number;
      sortOptions: readonly NativeSelectOption[];
      pageSizeOptions: readonly number[];
    };
    statusText: string;
    pageText: string;
    tickets: readonly NativeTicketRecord[];
    pagination: readonly NativeLinkAction[];
    auditTableHref?: string;
  };
  selectedTicket?: NativeTicketDetail;
}

interface NativeBaseMap {
  id: string;
  label: string;
  kind: 'provider' | 'custom';
  provider?: string;
  description?: string;
  active?: boolean;
}

interface NativeMapLayer {
  id: string;
  label: string;
  enabled: boolean;
  kind: string;
  privacyClass?: string;
  freshnessLabel?: string;
}

interface NativeMapEntity {
  id: string;
  label: string;
  kind: string;
  status?: string;
  locationLabel?: string;
  sourceRef?: string;
}

interface NativeMapWorkbenchSurface extends NativeRouteSurfaceBase {
  kind: 'portarium.native.mapWorkbench.v1';
  map: {
    mode: 'provider' | 'custom' | 'hybrid';
    activeBaseMapId: string;
    baseMaps: readonly NativeBaseMap[];
    layers: readonly NativeMapLayer[];
    entities: readonly NativeMapEntity[];
    selectionLabel?: string;
    tabs: readonly { id: string; label: string; count?: number }[];
    activeTab: string;
    readOnlyGroups: readonly NativeReadOnlyGroup[];
  };
}

interface NativeDataExplorerMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: NativeStatusBadge['tone'];
}

interface NativeDataExplorerSource {
  id: string;
  label: string;
  sourceSystem: string;
  sourceMode: string;
  category?: string;
  readiness?: string;
  freshness?: string;
  privacyClass?: string;
  itemCount?: number;
  recordCount?: number;
  summary: string;
  href?: string;
  visualisations?: readonly string[];
  answerableQuestions?: readonly string[];
  portariumSurfaces?: readonly string[];
}

interface NativeDataExplorerInsight {
  id: string;
  title: string;
  summary: string;
  tone?: NativeStatusBadge['tone'];
  sourceIds?: readonly string[];
  href?: string;
}

interface NativeDataExplorerSurface extends NativeRouteSurfaceBase {
  kind: 'portarium.native.dataExplorer.v1';
  explorer: {
    metrics: readonly NativeDataExplorerMetric[];
    sources: readonly NativeDataExplorerSource[];
    insights: readonly NativeDataExplorerInsight[];
    integrationNotes?: readonly string[];
  };
}

interface NativeReadOnlyGroup {
  id: string;
  label: string;
  description?: string;
  items: readonly NativeRelatedItem[];
}

interface NativeRelatedItem {
  id: string;
  label: string;
  summary?: string;
  metadata?: string;
}

interface NativeKeyValue {
  label: string;
  value: string;
}

interface NativeLinkAction {
  label: string;
  href: string;
  active?: boolean;
  disabled?: boolean;
}

interface NativeSelectOption {
  value: string;
  label: string;
}

type NativeRouteSurface =
  | NativeDataExplorerSurface
  | NativeTicketInboxSurface
  | NativeMapWorkbenchSurface;

export function hasNativeRouteSurface(value: unknown): value is NativeRouteSurfaceData {
  const nativeSurface = readRecord(value)?.nativeSurface;
  return isNativeRouteSurface(nativeSurface);
}

export function ExternalRouteNativeSurfaceRenderer({
  data,
  route,
  extension,
}: ExternalRouteComponentProps & { data: NativeRouteSurfaceData }) {
  const surface = data.nativeSurface;
  if (!isNativeRouteSurface(surface)) return null;

  if (surface.kind === 'portarium.native.mapWorkbench.v1') {
    return <NativeMapWorkbenchSurfaceRenderer surface={surface} extension={extension} />;
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

  return <NativeTicketInboxSurfaceRenderer surface={surface} extension={extension} routeId={route.id} />;
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

        <section className="space-y-3" aria-label="Data sources">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Read-Only Data Sources</h2>
              <p className="text-xs text-muted-foreground">
                Static source projections, connector posture, and useful questions for operator review.
              </p>
            </div>
            <Badge variant="outline">Host-rendered data explorer</Badge>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {surface.explorer.sources.map((source) => (
              <DataSourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>

        <section className="space-y-3" aria-label="Data insights">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Useful Things To Look For</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {surface.explorer.insights.map((insight) => (
              <Card key={insight.id} className="shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-sm">{insight.title}</CardTitle>
                    {insight.tone ? <Badge variant={badgeVariant(insight.tone)}>{insight.tone}</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{insight.summary}</p>
                  {insight.sourceIds && insight.sourceIds.length > 0 ? (
                    <p className="text-[11px]">Sources: {insight.sourceIds.join(', ')}</p>
                  ) : null}
                  {insight.href ? (
                    <Button asChild size="xs" variant="outline">
                      <a href={insight.href}>Open context</a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
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

function DataSourceCard({ source }: { source: NativeDataExplorerSource }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-primary" />
              {source.label}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {source.sourceSystem} · {source.sourceMode}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {source.category ? <Badge variant="secondary">{source.category}</Badge> : null}
            {source.readiness ? <Badge variant="outline">{source.readiness}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{source.summary}</p>
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <DataSourceStat label="Items" value={source.itemCount} />
          <DataSourceStat label="Records" value={source.recordCount} />
          <DataSourceStat label="Freshness" value={source.freshness} />
          <DataSourceStat label="Privacy" value={source.privacyClass} />
        </div>
        <TagList title="Visualise" items={source.visualisations ?? []} />
        <TagList title="Can answer" items={source.answerableQuestions ?? []} />
        <TagList title="Surfaces" items={source.portariumSurfaces ?? []} />
        {source.href ? (
          <Button asChild size="xs" variant="outline">
            <a href={source.href}>Open surface</a>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DataSourceStat({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
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
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
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
  return (
    <NativeSurfaceShell surface={surface} extension={extension} routeId={routeId}>
      <Card className="gap-0 py-0 shadow-none">
        <CardHeader className="border-b py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Inbox</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{surface.queue.statusText}</p>
            </div>
            <Badge variant="outline">Host-rendered</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <TicketViews views={surface.queue.views} />
          <TicketSearch search={surface.queue.search} />
          <TicketFilters filters={surface.queue.filters} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{surface.queue.statusText}</span>
            <span>{surface.queue.pageText}</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1.05fr)]">
            <TicketQueueList tickets={surface.queue.tickets} />
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
    <nav aria-label="Ticket views" className="flex flex-wrap gap-2">
      {views.map((view) => (
        <Button
          key={view.id}
          asChild
          size="sm"
          variant={view.active ? 'default' : 'outline'}
          className="justify-between gap-2"
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
    <form action={search.action} method="get" role="search" className="rounded-md border p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_140px_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="external-ticket-search" className="text-xs">
            Search
          </Label>
          <Input
            id="external-ticket-search"
            name="q"
            type="search"
            defaultValue={search.query ?? ''}
            placeholder="Ticket ID, room, category, source ref"
          />
        </div>
        <NativeSelect name="sort" label="Sort" value={search.sort} options={search.sortOptions} />
        <NativeSelect
          name="pageSize"
          label="Rows"
          value={String(search.pageSize)}
          options={search.pageSizeOptions.map((size) => ({
            value: String(size),
            label: String(size),
          }))}
        />
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Apply
          </Button>
        </div>
        <div className="flex items-end">
          <Button asChild type="button" variant="outline" className="w-full">
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
}: {
  name: string;
  label: string;
  value: string;
  options: readonly NativeSelectOption[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select name={name} defaultValue={value}>
        <SelectTrigger>
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
    <section aria-label="Ticket filters" className="space-y-2 rounded-md border p-3">
      {filters.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs font-medium">{group.label}</span>
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
  );
}

function TicketQueueList({ tickets }: { tickets: readonly NativeTicketRecord[] }) {
  if (tickets.length === 0) {
    return (
      <section aria-label="Queue list" className="rounded-md border p-4 text-sm text-muted-foreground">
        No matching tickets.
      </section>
    );
  }

  return (
    <section aria-label="Queue list" className="overflow-hidden rounded-md border">
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Queue List</h2>
        <span className="text-xs text-muted-foreground">Select a row to load the reader.</span>
      </header>
      <div className="max-h-[min(70vh,760px)] overflow-y-auto divide-y">
        {tickets.map((ticket) => (
          <a
            key={ticket.id}
            href={ticket.href}
            aria-current={ticket.selected ? 'true' : undefined}
            aria-controls="ticket-reader"
            aria-label={ticket.selected ? `Selected ticket ${ticket.label}` : `Select ticket ${ticket.label}`}
            className={cn(
              'grid gap-2 border-l-2 px-3 py-3 text-sm transition-colors hover:bg-accent/60',
              ticket.selected
                ? 'border-l-primary bg-accent text-accent-foreground'
                : 'border-l-transparent',
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <strong>{ticket.label}</strong>
              <Badge variant={ticket.lifecycle === 'open' ? 'info' : 'outline'}>
                {ticket.statusLabel}
              </Badge>
            </span>
            <span className="text-xs text-muted-foreground">{ticket.summary}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{ticket.priorityLabel}</span>
              <span>{ticket.typeLabel ?? 'Unspecified'}</span>
              <span>{ticket.category ?? 'Uncategorised'}</span>
              <span>{ticket.updatedAtLabel}</span>
              {ticket.dueLabel ? <span>{ticket.dueLabel}</span> : null}
            </span>
            <span className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-medium text-primary">{ticket.roomLabel ?? 'No room hint'}</span>
              <code className="truncate text-muted-foreground">{ticket.sourceRef}</code>
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
    <section id="ticket-reader" aria-label="Ticket reader" className="space-y-4 rounded-md border p-4">
      <header className="space-y-2 border-b pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Selected Ticket</h2>
            <p className="text-xs text-muted-foreground">{detail.sourceRef}</p>
          </div>
          <span className="text-xs text-muted-foreground">Read-only ticket detail</span>
        </div>
        <p className="text-sm text-muted-foreground">{detail.summary}</p>
        <StatusBadges badges={detail.badges} />
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Conversation</h3>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-sm font-medium">{detail.conversation.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail.conversation.message}</p>
          {detail.conversation.summary ? (
            <p className="mt-2 text-sm">{detail.conversation.summary}</p>
          ) : null}
        </div>
      </section>

      <KeyValueSection title="Properties" items={detail.properties} />

      <section className="space-y-2">
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
        <RelatedItems items={detail.relatedContext.items} emptyText="No extra redacted context item matched this ticket." />
      </section>

      <details className="rounded-md border bg-muted/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Diagnostics</summary>
        <div className="mt-3">
          <KeyValueList items={detail.diagnostics} />
        </div>
      </details>
    </section>
  );
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
}: {
  surface: NativeMapWorkbenchSurface;
  extension: ResolvedCockpitExtension;
}) {
  const [activeTab, setActiveTab] = useState(surface.map.activeTab);
  const [activeBaseMapId, setActiveBaseMapId] = useState(surface.map.activeBaseMapId);
  const activeBaseMap = useMemo(
    () => surface.map.baseMaps.find((baseMap) => baseMap.id === activeBaseMapId),
    [activeBaseMapId, surface.map.baseMaps],
  );

  return (
    <div className="h-[calc(100vh-7rem)] p-6">
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
          status: entity.status === 'critical' || entity.status === 'warning' ? entity.status : 'normal',
          privacyClass: 'internal' as const,
          freshness: { state: 'cached' as const, label: 'Snapshot' },
          payload: entity,
        }))}
      />
    </div>
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
        <div className="absolute inset-x-8 top-1/3 h-px bg-border" />
        <div className="absolute inset-y-8 left-1/3 w-px bg-border" />
        <div className="absolute right-10 bottom-10 left-10 h-24 rounded-lg border border-primary/30 bg-primary/5" />
        <div className="absolute top-10 right-10 h-32 w-44 rounded-lg border border-border bg-background/80" />
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
        {entities.slice(0, 4).map((entity) => (
          <div key={entity.id} className="rounded-md border bg-background/95 px-3 py-2 shadow-sm">
            <p className="text-xs font-semibold">{entity.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {entity.kind}
              {entity.locationLabel ? ` · ${entity.locationLabel}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
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
  const content = (
    <div className="min-w-0 flex-1 space-y-4">
      <PageHeader
        title={surface.title}
        description={surface.description ?? extension.manifest.description}
        status={<StatusBadges badges={surface.badges ?? [{ label: routeId, tone: 'neutral' }]} />}
      />
      {children}
    </div>
  );

  if (!surface.area) {
    return <div className="p-6">{content}</div>;
  }

  return (
    <div className="flex flex-wrap items-start gap-4 p-6">
      <aside className="w-full shrink-0 rounded-md border bg-card p-3 sm:w-56">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{surface.area.label}</p>
        <h2 className="mt-1 text-base font-semibold">{surface.area.title}</h2>
        <nav aria-label={`${surface.area.label} areas`} className="mt-4 grid gap-1">
          {surface.area.navItems.map((item) => (
            <Button
              key={item.id}
              asChild
              variant={item.active ? 'secondary' : 'ghost'}
              className="h-auto justify-start px-2 py-2"
            >
              <a href={item.href} aria-current={item.active ? 'page' : undefined}>
                <span className="grid gap-0.5 text-left">
                  <span>{item.label}</span>
                  {item.detail ? (
                    <span className="text-xs font-normal text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
              </a>
            </Button>
          ))}
        </nav>
        {surface.area.boundary && surface.area.boundary.length > 0 ? (
          <div className="mt-4 space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {surface.area.boundary.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
      </aside>
      {content}
    </div>
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
        <div key={item.label} className="grid grid-cols-[minmax(96px,0.42fr)_minmax(0,1fr)] gap-3 px-3 py-2 text-xs">
          <dt className="text-muted-foreground">{item.label}</dt>
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
          {item.summary ? <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p> : null}
          {item.metadata ? <p className="mt-1 text-[11px] text-muted-foreground">{item.metadata}</p> : null}
        </article>
      ))}
    </div>
  );
}

function isNativeRouteSurface(value: unknown): value is NativeRouteSurface {
  const record = readRecord(value);
  const kind = record?.kind;
  return (
    kind === 'portarium.native.dataExplorer.v1' ||
    kind === 'portarium.native.ticketInbox.v1' ||
    kind === 'portarium.native.mapWorkbench.v1'
  );
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function badgeVariant(tone: NativeStatusBadge['tone']): React.ComponentProps<typeof Badge>['variant'] {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  if (tone === 'info') return 'info';
  if (tone === 'critical') return 'destructive';
  return 'outline';
}
