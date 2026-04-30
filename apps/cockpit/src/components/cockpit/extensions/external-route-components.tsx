import { lazy, type ComponentType } from 'react';
import { INSTALLED_COCKPIT_ROUTE_LOADERS } from '@/lib/extensions/installed';
import type { CockpitExtensionRouteModuleLoader } from '@/lib/extensions/types';
import type { ExternalRouteComponent, ExternalRouteComponentProps } from './external-route-adapter';

export const HOSTED_EXTERNAL_ROUTE_COMPONENTS = buildHostedExternalRouteComponents();

type HostedExternalRouteModule = {
  default: ComponentType;
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
        default: adaptRouteComponent(routeModule.default as ComponentType),
      };
    });

    components[routeId] = function HostedExternalRoute(props: ExternalRouteComponentProps) {
      return <LoadedRoute {...props} />;
    };
  }

  return components;
}

function adaptRouteComponent(Component: ComponentType): ExternalRouteComponent {
  return function ExternalRouteComponentAdapter(_props: ExternalRouteComponentProps) {
    return <Component />;
  };
}
