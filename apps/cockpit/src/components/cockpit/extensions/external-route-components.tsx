import { lazy, type ComponentType } from 'react';
import {
  INSTALLED_COCKPIT_ROUTE_DATA_LOADERS,
  INSTALLED_COCKPIT_ROUTE_LOADERS,
} from '@/lib/extensions/installed';
import type {
  CockpitExtensionHostReadModelContext,
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
      return {
        status: 'loaded',
        endpoint: `host-loader:${routeId}`,
        response: data,
        data,
      };
    } catch (error) {
      return {
        status: 'failed',
        endpoint: `host-loader:${routeId}`,
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
        message: readHostReadModelError(payload) ?? `Read model endpoint returned ${response.status}.`,
      };
    }

    return {
      status: 'loaded',
      endpoint,
      response: payload,
      data: unwrapHostReadModelData(payload),
    };
  } catch (error) {
    return {
      status: 'failed',
      endpoint,
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

function readHostReadModelError(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const message = payload.message ?? payload.detail ?? payload.title;
  return typeof message === 'string' ? message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
