import { lazy, type ComponentType } from 'react';
import {
  INSTALLED_COCKPIT_ROUTE_DATA_LOADERS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
} from '@/lib/extensions/installed';
import type {
  CockpitExtensionHostReadModelContext,
  CockpitExtensionHostReadModelMetadata,
  CockpitExtensionHostReadModelSourceRef,
  CockpitExtensionPrivacyClass,
  CockpitExtensionRouteLoaderContext,
  CockpitExtensionRouteModuleLoader,
} from '@/lib/extensions/types';
import type { ExternalRouteComponent, ExternalRouteComponentProps } from './external-route-adapter';
import {
  ExternalRouteDataRenderer,
  type ExternalRouteDataLoader,
} from './external-route-data-renderer';

export const HOSTED_EXTERNAL_ROUTE_COMPONENTS = buildHostedExternalRouteComponents();

export type HostedExternalRouteModule = {
  default?: ComponentType<ExternalRouteComponentProps>;
  loader?: (context: CockpitExtensionRouteLoaderContext) => unknown | Promise<unknown>;
  routeModule?: {
    loader?: (context: CockpitExtensionRouteLoaderContext) => unknown | Promise<unknown>;
  };
  hostRendering?: {
    mode: 'host-native';
  };
};

function buildHostedExternalRouteComponents(): Readonly<Record<string, ExternalRouteComponent>> {
  const components: Record<string, ExternalRouteComponent> = {};
  const routeLoaders: Readonly<
    Record<string, CockpitExtensionRouteModuleLoader<HostedExternalRouteModule>>
  > = INSTALLED_COCKPIT_ROUTE_LOADERS as Readonly<
    Record<string, CockpitExtensionRouteModuleLoader<HostedExternalRouteModule>>
  >;

  for (const [routeId, loadModule] of Object.entries(routeLoaders)) {
    const LoadedRoute = lazy(async () => {
      const routeModule = await loadModule();
      return {
        default: createHostedExternalRouteComponent(routeModule),
      };
    });

    components[routeId] = function HostedExternalRoute(props: ExternalRouteComponentProps) {
      return <LoadedRoute {...props} />;
    };
  }

  return components;
}

export function createHostedExternalRouteComponent(
  routeModule: HostedExternalRouteModule,
): ExternalRouteComponent {
  const Component = routeModule.default;
  const routeDataLoader = routeModule.loader ?? routeModule.routeModule?.loader;
  if (Component && routeModule.hostRendering?.mode !== 'host-native') {
    return function ExternalRouteComponentAdapter(props: ExternalRouteComponentProps) {
      return <Component {...props} />;
    };
  }

  if (routeDataLoader) {
    return function ExternalRouteDataAdapter(props: ExternalRouteComponentProps) {
      const loadData: ExternalRouteDataLoader = async () => {
        const baseContext = {
          manifest: props.extension.manifest,
          route: props.route,
          workspacePackRefs: props.extension.workspacePackRefs ?? [],
          params: props.params,
          pathname: props.pathname,
          searchParams: props.searchParams,
          hash: props.hash,
        };
        const hostReadModel = await loadConfiguredHostReadModel(props.route.id, baseContext);

        return Promise.resolve(
          routeDataLoader({
            ...baseContext,
            ...(hostReadModel ? { hostReadModel } : {}),
          }),
        );
      };

      return <ExternalRouteDataRenderer {...props} loadData={loadData} />;
    };
  }

  return function MissingExternalRouteModule(props: ExternalRouteComponentProps) {
    return (
      <ExternalRouteDataRenderer
        {...props}
        loadData={() =>
          Promise.reject(new Error(`Route module "${props.route.id}" did not export a renderer.`))
        }
      />
    );
  };
}

async function loadConfiguredHostReadModel(
  routeId: string,
  context: CockpitExtensionRouteLoaderContext,
): Promise<CockpitExtensionHostReadModelContext | undefined> {
  const routeDataLoader = INSTALLED_COCKPIT_ROUTE_DATA_LOADERS[routeId];
  if (routeDataLoader) {
    try {
      const data = await routeDataLoader(context);
      return buildLoadedHostReadModelContext({
        routeId,
        endpoint: `host-loader:${routeId}`,
        response: data,
        data: unwrapHostReadModelData(data),
      });
    } catch (error) {
      return {
        status: 'failed',
        endpoint: `host-loader:${routeId}`,
        routeId,
        scopeId: routeId,
        message: error instanceof Error ? error.message : 'Host route read model loader failed.',
      };
    }
  }

  const endpoint = readConfiguredHostReadModelEndpoint(routeId);
  if (!endpoint) return undefined;

  try {
    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      return {
        status: 'failed',
        endpoint,
        routeId,
        scopeId: routeId,
        message:
          readHostReadModelError(payload) ?? `Read model endpoint returned ${response.status}.`,
      };
    }

    return buildLoadedHostReadModelContext({
      routeId,
      endpoint,
      response: payload,
      data: unwrapHostReadModelData(payload),
    });
  } catch (error) {
    return {
      status: 'failed',
      endpoint,
      routeId,
      scopeId: routeId,
      message: error instanceof Error ? error.message : 'Host read model endpoint failed.',
    };
  }
}

export function readConfiguredHostReadModelEndpoint(routeId: string): string | undefined {
  const rawConfig = import.meta.env.VITE_COCKPIT_ROUTE_READ_MODEL_ENDPOINTS;
  if (!rawConfig) return undefined;

  for (const entry of rawConfig.split(';')) {
    const separator = entry.indexOf('=');
    if (separator <= 0) continue;

    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key === routeId && value.length > 0) return value;
  }

  return undefined;
}

function unwrapHostReadModelData(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (payload.ok === true && 'data' in payload) return payload.data;
  return payload;
}

function buildLoadedHostReadModelContext({
  routeId,
  endpoint,
  response,
  data,
}: {
  routeId: string;
  endpoint: string;
  response: unknown;
  data: unknown;
}): CockpitExtensionHostReadModelContext {
  const metadata = readHostReadModelMetadata(response);
  return {
    status: 'loaded',
    routeId,
    scopeId: metadata.scopeId ?? routeId,
    contentType: metadata.contentType ?? 'application/json',
    freshness: metadata.freshness ?? 'unknown',
    loadedAtIso: metadata.loadedAtIso ?? new Date().toISOString(),
    endpoint,
    response,
    data,
    ...(metadata.dataOrigin ? { dataOrigin: metadata.dataOrigin } : {}),
    ...(metadata.privacyClass ? { privacyClass: metadata.privacyClass } : {}),
    ...(metadata.sourceRefs ? { sourceRefs: metadata.sourceRefs } : {}),
  };
}

function readHostReadModelMetadata(payload: unknown): CockpitExtensionHostReadModelMetadata {
  if (!isRecord(payload)) return {};
  const metadata = isRecord(payload.meta)
    ? payload.meta
    : isRecord(payload.readModel)
      ? payload.readModel
      : payload;

  const scopeId = readOptionalString(metadata.scopeId);
  const contentType = readOptionalString(metadata.contentType);
  const dataOrigin = readOptionalString(metadata.dataOrigin);
  const freshness = readFreshness(metadata.freshness);
  const privacyClass = readPrivacyClass(metadata.privacyClass);
  const loadedAtIso = readOptionalString(metadata.loadedAtIso ?? metadata.generatedAtIso);
  const sourceRefs = readSourceRefs(metadata.sourceRefs);

  return {
    ...(scopeId ? { scopeId } : {}),
    ...(contentType ? { contentType } : {}),
    ...(dataOrigin ? { dataOrigin } : {}),
    ...(freshness ? { freshness } : {}),
    ...(privacyClass ? { privacyClass } : {}),
    ...(loadedAtIso ? { loadedAtIso } : {}),
    ...(sourceRefs ? { sourceRefs } : {}),
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readFreshness(
  value: unknown,
): CockpitExtensionHostReadModelMetadata['freshness'] | undefined {
  if (
    value === 'live' ||
    value === 'fresh' ||
    value === 'stale' ||
    value === 'expired' ||
    value === 'snapshot' ||
    value === 'unknown'
  ) {
    return value;
  }
  return undefined;
}

function readPrivacyClass(value: unknown): CockpitExtensionPrivacyClass | undefined {
  if (
    value === 'public' ||
    value === 'internal' ||
    value === 'restricted' ||
    value === 'sensitive' ||
    value === 'highly_restricted'
  ) {
    return value;
  }
  return undefined;
}

function readSourceRefs(
  value: unknown,
): readonly CockpitExtensionHostReadModelSourceRef[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const refs = value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.trim().length === 0) return [];
    const label = readOptionalString(item.label);
    const sourceSystem = readOptionalString(item.sourceSystem);
    const sourceMode = readOptionalString(item.sourceMode);
    const observedAtIso = readOptionalString(item.observedAtIso);

    return [
      {
        id: item.id,
        ...(label ? { label } : {}),
        ...(sourceSystem ? { sourceSystem } : {}),
        ...(sourceMode ? { sourceMode } : {}),
        ...(observedAtIso ? { observedAtIso } : {}),
      },
    ];
  });

  return refs.length > 0 ? refs : undefined;
}

function readHostReadModelError(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const message = payload.message ?? payload.detail ?? payload.title;
  return typeof message === 'string' ? message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
