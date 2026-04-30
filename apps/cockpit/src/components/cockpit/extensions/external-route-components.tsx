import { lazy, type ComponentType } from 'react';
import { INSTALLED_COCKPIT_EXTENSION_MODULES } from '@/lib/extensions/installed';
import type { ExternalRouteComponent, ExternalRouteComponentProps } from './external-route-adapter';

export const HOSTED_EXTERNAL_ROUTE_COMPONENTS = buildHostedExternalRouteComponents();

function buildHostedExternalRouteComponents(): Readonly<Record<string, ExternalRouteComponent>> {
  const components: Record<string, ExternalRouteComponent> = {};

  for (const extension of INSTALLED_COCKPIT_EXTENSION_MODULES) {
    for (const routeModuleRef of extension.routeModules) {
      const LoadedRoute = lazy(async () => {
        const routeModule = await routeModuleRef.loadModule();
        return {
          default: adaptRouteComponent(routeModule.default as ComponentType),
        };
      });

      components[routeModuleRef.routeId] = function HostedExternalRoute(
        props: ExternalRouteComponentProps,
      ) {
        return <LoadedRoute {...props} />;
      };
    }
  }

  return components;
}

function adaptRouteComponent(Component: ComponentType): ExternalRouteComponent {
  return function ExternalRouteComponentAdapter(_props: ExternalRouteComponentProps) {
    return <Component />;
  };
}
