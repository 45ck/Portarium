import { describe, expect, it } from 'vitest';

import { PackId } from '../primitives/index.js';
import { parseSemVer } from '../versioning/semver.js';
import {
  InMemoryPackRegistry,
  PackNotFoundError,
  PackVersionNotFoundError,
} from './pack-registry.js';
import { parsePackManifestV1 } from './pack-manifest.js';

describe('pack-registry', () => {
  it('throws PackNotFoundError for unknown packs', () => {
    const registry = new InMemoryPackRegistry();
    expect(() => registry.listPackVersions(PackId('scm.unknown'))).toThrow(PackNotFoundError);
  });

  it('throws PackVersionNotFoundError for unknown versions', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(
      parsePackManifestV1({
        manifestVersion: 1,
        kind: 'VerticalPack',
        id: 'scm.a',
        version: '1.0.0',
        requiresCore: '*',
        displayName: 'A',
        assets: {},
      }),
    );

    expect(() => registry.readPackManifest(PackId('scm.a'), parseSemVer('2.0.0'))).toThrow(
      PackVersionNotFoundError,
    );
  });
});
