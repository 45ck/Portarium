import type { CockpitExtensionManifest } from './types';
import { EXAMPLE_REFERENCE_EXTENSION } from './example-reference/manifest';

export const NEUTRAL_REFERENCE_EXTENSION: CockpitExtensionManifest = EXAMPLE_REFERENCE_EXTENSION;

export const COCKPIT_EXTENSION_FIXTURES: readonly CockpitExtensionManifest[] = [
  NEUTRAL_REFERENCE_EXTENSION,
];
