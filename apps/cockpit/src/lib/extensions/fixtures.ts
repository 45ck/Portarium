import type { CockpitExtensionManifest } from './types';
import { EXAMPLE_OPS_DEMO_EXTENSION } from './example-ops-demo/manifest';

export const NEUTRAL_OPS_EXTENSION: CockpitExtensionManifest = EXAMPLE_OPS_DEMO_EXTENSION;

export const COCKPIT_EXTENSION_FIXTURES: readonly CockpitExtensionManifest[] = [
  NEUTRAL_OPS_EXTENSION,
];
