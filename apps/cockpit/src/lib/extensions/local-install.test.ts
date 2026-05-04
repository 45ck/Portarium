import { describe, expect, it } from 'vitest';
import { EXAMPLE_REFERENCE_EXTENSION } from './example-reference/manifest';
import { collectLocalInstallModules } from './local-install';
import type { CockpitInstalledExtension } from './types';

const installedExtension = {
  manifest: EXAMPLE_REFERENCE_EXTENSION,
  packageRef: {
    packageName: '@portarium/cockpit-example-reference-extension',
    version: '0.1.0',
  },
  routeModules: EXAMPLE_REFERENCE_EXTENSION.routes.map((route) => ({
    routeId: route.id,
    loadModule: () => Promise.resolve({}),
  })),
  workspacePackRefs: [{ packId: 'example.reference' }],
} satisfies CockpitInstalledExtension;

describe('local cockpit extension install modules', () => {
  it('accepts a default installed extension export', () => {
    const collection = collectLocalInstallModules({
      './local-installed/reference.local.ts': { default: installedExtension },
    });

    expect(collection.extensions).toEqual([installedExtension]);
    expect(collection.problems).toEqual([]);
  });

  it('accepts an installedExtensions named export array', () => {
    const collection = collectLocalInstallModules({
      './local-installed/reference.local.ts': { installedExtensions: [installedExtension] },
    });

    expect(collection.extensions).toEqual([installedExtension]);
    expect(collection.problems).toEqual([]);
  });

  it('reports invalid local install module exports without throwing', () => {
    const collection = collectLocalInstallModules({
      './local-installed/empty.local.ts': {},
      './local-installed/broken.local.ts': { default: { manifest: EXAMPLE_REFERENCE_EXTENSION } },
    });

    expect(collection.extensions).toEqual([]);
    expect(collection.problems).toEqual([
      expect.objectContaining({
        code: 'invalid-manifest',
        itemId: './local-installed/broken.local.ts',
      }),
      expect.objectContaining({
        code: 'invalid-manifest',
        itemId: './local-installed/empty.local.ts',
      }),
    ]);
  });
});
