import { describe, expect, it } from 'vitest';

import { PackId } from '../primitives/index.js';
import { parseSemVer } from '../versioning/semver.js';
import { parseSemVerRange } from '../versioning/semver-range.js';
import type { PackManifestV1 } from './pack-manifest.js';
import { InMemoryPackRegistry } from './pack-registry.js';
import {
  PackCoreCompatibilityError,
  PackDependencyConflictError,
  PackNoSatisfyingVersionError,
  PackResolutionError,
  resolvePacksV1,
} from './pack-resolver.js';

function m(params: {
  id: string;
  version: string;
  requiresCore?: string;
  dependencies?: Record<string, string>;
}): PackManifestV1 {
  const dependencies = params.dependencies
    ? Object.fromEntries(
        Object.entries(params.dependencies).map(([id, range]) => [id, parseSemVerRange(range)]),
      )
    : undefined;

  return {
    manifestVersion: 1,
    kind: 'VerticalPack',
    id: PackId(params.id),
    version: parseSemVer(params.version),
    requiresCore: parseSemVerRange(params.requiresCore ?? '*'),
    displayName: params.id,
    ...(dependencies ? { dependencies } : {}),
    assets: {},
  };
}

describe('resolvePacksV1', () => {
  it('picks the highest version that satisfies all ranges and core compatibility', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(m({ id: 'scm.change-management', version: '1.0.0', requiresCore: '>=1.0.0' }));
    registry.add(m({ id: 'scm.change-management', version: '1.2.0', requiresCore: '>=1.0.0' }));
    // Incompatible with the core version used below, so it must be skipped.
    registry.add(m({ id: 'scm.change-management', version: '2.0.0', requiresCore: '>=3.0.0' }));

    const lock = resolvePacksV1({
      coreVersion: parseSemVer('1.5.0'),
      requests: [{ id: PackId('scm.change-management'), range: parseSemVerRange('*') }],
      registry,
      now: new Date('2026-02-16T00:00:00.000Z'),
    });

    expect(lock.lockfileVersion).toBe(1);
    expect(lock.generatedAt).toBe('2026-02-16T00:00:00.000Z');
    expect(lock.packs).toEqual([
      { id: PackId('scm.change-management'), version: parseSemVer('1.2.0') },
    ]);
  });

  it('resolves transitive dependencies', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(
      m({
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        dependencies: { 'core.base': '>=2.0.0' },
      }),
    );
    registry.add(m({ id: 'core.base', version: '2.0.0', requiresCore: '*' }));

    const lock = resolvePacksV1({
      coreVersion: parseSemVer('1.0.0'),
      requests: [{ id: PackId('scm.change-management'), range: parseSemVerRange('*') }],
      registry,
      now: new Date('2026-02-16T00:00:00.000Z'),
    });

    expect(lock.packs).toEqual([
      { id: PackId('core.base'), version: parseSemVer('2.0.0') },
      { id: PackId('scm.change-management'), version: parseSemVer('1.0.0') },
    ]);
  });

  it('throws on dependency conflicts discovered after an earlier resolution', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(m({ id: 'core.base', version: '1.0.0', requiresCore: '*' }));
    registry.add(m({ id: 'core.base', version: '2.0.0', requiresCore: '*' }));
    registry.add(
      m({
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        dependencies: { 'core.base': '>=2.0.0' },
      }),
    );

    expect(() =>
      resolvePacksV1({
        coreVersion: parseSemVer('1.0.0'),
        // Resolve core.base first to a version that will later become invalid.
        requests: [
          { id: PackId('core.base'), range: parseSemVerRange('=1.0.0') },
          { id: PackId('scm.change-management'), range: parseSemVerRange('*') },
        ],
        registry,
        now: new Date('2026-02-16T00:00:00.000Z'),
      }),
    ).toThrowError(PackDependencyConflictError);
  });

  it('throws a specific error when a range is satisfiable but core compatibility is not', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(m({ id: 'scm.change-management', version: '1.0.0', requiresCore: '>=2.0.0' }));

    expect(() =>
      resolvePacksV1({
        coreVersion: parseSemVer('1.0.0'),
        requests: [{ id: PackId('scm.change-management'), range: parseSemVerRange('*') }],
        registry,
        now: new Date('2026-02-16T00:00:00.000Z'),
      }),
    ).toThrowError(PackCoreCompatibilityError);
  });

  it('throws when no version satisfies all requested ranges', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(m({ id: 'scm.change-management', version: '1.0.0', requiresCore: '*' }));

    expect(() =>
      resolvePacksV1({
        coreVersion: parseSemVer('1.0.0'),
        requests: [{ id: PackId('scm.change-management'), range: parseSemVerRange('>=2.0.0') }],
        registry,
        now: new Date('2026-02-16T00:00:00.000Z'),
      }),
    ).toThrowError(PackNoSatisfyingVersionError);
  });

  it('throws when dependency graph contains a cycle', () => {
    const registry = new InMemoryPackRegistry();
    registry.add(
      m({
        id: 'scm.change-management',
        version: '1.0.0',
        requiresCore: '*',
        dependencies: { 'core.base': '*' },
      }),
    );
    registry.add(
      m({
        id: 'core.base',
        version: '1.0.0',
        requiresCore: '*',
        dependencies: { 'scm.change-management': '*' },
      }),
    );

    expect(() =>
      resolvePacksV1({
        coreVersion: parseSemVer('1.0.0'),
        requests: [{ id: PackId('scm.change-management'), range: parseSemVerRange('*') }],
        registry,
        now: new Date('2026-02-16T00:00:00.000Z'),
      }),
    ).toThrowError(PackResolutionError);
  });
});
