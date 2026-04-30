import type { ComponentType } from 'react';
import type { CockpitExtensionRouteModuleLoader } from '../types';
import { EXAMPLE_REFERENCE_EXTENSION } from './manifest';

export interface CockpitExtensionRouteModule {
  default: ComponentType;
}

type ExampleReferenceRouteId = (typeof EXAMPLE_REFERENCE_EXTENSION.routes)[number]['id'];

export const EXAMPLE_REFERENCE_ROUTE_LOADERS = {
  'example-reference-overview': () => import('./routes/overview'),
  'example-reference-review': () => import('./routes/action-review'),
} satisfies Record<
  ExampleReferenceRouteId,
  CockpitExtensionRouteModuleLoader<CockpitExtensionRouteModule>
>;
