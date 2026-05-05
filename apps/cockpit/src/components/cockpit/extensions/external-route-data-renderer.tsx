import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Database, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/cockpit/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExternalRouteComponentProps } from './external-route-adapter';
import {
  ExternalRouteNativeSurfaceRenderer,
  hasNativeRouteSurface,
} from './external-route-native-surfaces';

export type ExternalRouteDataLoader = (props: ExternalRouteComponentProps) => Promise<unknown>;

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: unknown }
  | { status: 'failed'; message: string };

interface RouteStubSection {
  id: string;
  title: string;
  summary: string;
  classification?: string;
}

interface RouteStubAction {
  id: string;
  label: string;
  reason?: string;
  disabled?: boolean;
}

interface RouteStubData {
  title?: string;
  status?: string;
  message?: string;
  safety?: Record<string, unknown>;
  emptyState?: {
    heading?: string;
    body?: string;
    nextStep?: string;
  };
  sections?: readonly RouteStubSection[];
  actions?: readonly RouteStubAction[];
  data?: unknown;
}

export function ExternalRouteDataRenderer(
  props: ExternalRouteComponentProps & { loadData: ExternalRouteDataLoader },
) {
  const { route, extension, params, pathname, searchParams, hash, loadData } = props;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const routeParams = useMemo(
    () => Object.entries(params).map(([key, value]) => `${key}=${value}`),
    [params],
  );

  useEffect(() => {
    let mounted = true;
    setState({ status: 'loading' });
    loadData({ route, extension, params, pathname, searchParams, hash })
      .then((data) => {
        if (mounted) setState({ status: 'loaded', data });
      })
      .catch((error: unknown) => {
        if (mounted) {
          setState({
            status: 'failed',
            message: error instanceof Error ? error.message : 'Route loader failed.',
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, [extension, hash, loadData, params, pathname, route, searchParams]);

  if (state.status === 'loading') {
    return (
      <RouteShell
        title={route.title}
        description="Loading extension route data"
        badges={[extension.manifest.displayName, route.id, ...routeParams]}
      >
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <span
              className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"
              role="status"
              aria-label="Loading extension data"
            />
            Preparing extension data
          </CardContent>
        </Card>
      </RouteShell>
    );
  }

  if (state.status === 'failed') {
    return (
      <RouteShell
        title="Extension Route Failed"
        description={state.message}
        badges={[extension.manifest.displayName, route.id, ...routeParams]}
      >
        <Card className="border-destructive/40 shadow-none">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            The host stopped before rendering extension data.
          </CardContent>
        </Card>
      </RouteShell>
    );
  }

  if (hasNativeRouteSurface(state.data)) {
    return <ExternalRouteNativeSurfaceRenderer {...propsForNative(props)} data={state.data} />;
  }

  const stub = toRouteStubData(state.data);
  const facts = createDataFacts(stub.data ?? state.data);

  return (
    <RouteShell
      title={stub.title ?? route.title}
      description={stub.message ?? route.description ?? extension.manifest.description}
      badges={[extension.manifest.displayName, route.id, stub.status ?? 'loaded', ...routeParams]}
    >
      {stub.safety ? <SafetyPanel safety={stub.safety} /> : null}
      {stub.emptyState ? <EmptyStatePanel emptyState={stub.emptyState} /> : null}
      {stub.sections && stub.sections.length > 0 ? (
        <SectionsPanel sections={stub.sections} />
      ) : null}
      {stub.actions && stub.actions.length > 0 ? <ActionsPanel actions={stub.actions} /> : null}
      <FactsPanel facts={facts} />
    </RouteShell>
  );
}

function propsForNative(
  props: ExternalRouteComponentProps & { loadData: ExternalRouteDataLoader },
): ExternalRouteComponentProps {
  return {
    route: props.route,
    extension: props.extension,
    params: props.params,
    pathname: props.pathname,
    searchParams: props.searchParams,
    hash: props.hash,
  };
}

function RouteShell({
  title,
  description,
  badges,
  children,
}: {
  title: string;
  description: string;
  badges: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title={title} description={description} />
      <div className="flex flex-wrap gap-2">
        {badges.filter(Boolean).map((badge) => (
          <Badge key={badge} variant="outline">
            {badge}
          </Badge>
        ))}
      </div>
      {children}
    </div>
  );
}

function SafetyPanel({ safety }: { safety: Record<string, unknown> }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Safety Contract
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(safety).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="text-muted-foreground">{labelize(key)}</div>
            <div className="font-medium">{formatValue(value)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyStatePanel({ emptyState }: { emptyState: NonNullable<RouteStubData['emptyState']> }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{emptyState.heading ?? 'Extension route data'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {emptyState.body ? <p>{emptyState.body}</p> : null}
        {emptyState.nextStep ? <p>{emptyState.nextStep}</p> : null}
      </CardContent>
    </Card>
  );
}

function SectionsPanel({ sections }: { sections: readonly RouteStubSection[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <Card key={section.id} className="shadow-none">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base">{section.title}</CardTitle>
            {section.classification ? (
              <Badge variant="secondary">{section.classification}</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{section.summary}</CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActionsPanel({ actions }: { actions: readonly RouteStubAction[] }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Available Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {actions.map((action) => (
          <div key={action.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{action.label}</span>
              <Badge variant={action.disabled ? 'outline' : 'secondary'}>
                {action.disabled ? 'disabled' : 'available'}
              </Badge>
            </div>
            {action.reason ? (
              <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FactsPanel({ facts }: { facts: readonly string[] }) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          Data Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {facts.map((fact) => (
          <Badge key={fact} variant="outline">
            {fact}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

function toRouteStubData(value: unknown): RouteStubData {
  return isRecord(value) ? value : {};
}

function createDataFacts(value: unknown): readonly string[] {
  if (!isRecord(value)) return ['payload loaded'];

  const facts = Object.entries(value).map(([key, child]) => {
    if (Array.isArray(child)) return `${labelize(key)}: ${child.length}`;
    if (isRecord(child)) return `${labelize(key)}: ${Object.keys(child).length}`;
    return `${labelize(key)}: ${formatValue(child)}`;
  });

  return facts.length > 0 ? facts : ['payload loaded'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function labelize(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value === null) return 'none';
  if (Array.isArray(value)) return `${value.length}`;
  if (isRecord(value)) return `${Object.keys(value).length}`;
  return 'unknown';
}
