import type { ComponentType } from 'react';
import type { CockpitExtensionRouteModuleLoader } from '../types';
import { EXAMPLE_OPS_DEMO_EXTENSION } from './manifest';

export interface CockpitExtensionRouteModule {
  default: ComponentType;
}

type ExampleOpsDemoRouteId = (typeof EXAMPLE_OPS_DEMO_EXTENSION.routes)[number]['id'];

export const EXAMPLE_OPS_DEMO_ROUTE_LOADERS = {
  'example-ops-overview': () => import('./routes/overview'),
  'example-ops-action-review': () => import('./routes/action-review'),
} satisfies Record<
  ExampleOpsDemoRouteId,
  CockpitExtensionRouteModuleLoader<CockpitExtensionRouteModule>
>;
