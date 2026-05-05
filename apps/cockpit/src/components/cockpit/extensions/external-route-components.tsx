import { lazy, type ComponentType } from 'react';
import { INSTALLED_COCKPIT_ROUTE_LOADERS } from '@/lib/extensions/installed';
import type {
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
      const loadData: ExternalRouteDataLoader = () =>
        Promise.resolve(
          routeDataLoader({
            manifest: props.extension.manifest,
            route: props.route,
            workspacePackRefs: props.extension.workspacePackRefs ?? [],
            params: props.params,
            pathname: props.pathname,
            searchParams: props.searchParams,
            hash: props.hash,
          }),
        );

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
