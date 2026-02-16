import type { PackId } from '../primitives/index.js';
import type { SemVer } from '../versioning/semver.js';
import { formatSemVer } from '../versioning/semver.js';
import type { PackManifestV1 } from './pack-manifest.js';

export interface PackRegistry {
  listPackVersions(packId: PackId): readonly SemVer[];
  readPackManifest(packId: PackId, version: SemVer): PackManifestV1;
}

export class PackNotFoundError extends Error {
  public override readonly name = 'PackNotFoundError';
  public readonly packId: PackId;

  public constructor(packId: PackId) {
    super(`Pack not found: ${packId}`);
    this.packId = packId;
  }
}

export class PackVersionNotFoundError extends Error {
  public override readonly name = 'PackVersionNotFoundError';
  public readonly packId: PackId;
  public readonly version: string;

  public constructor(packId: PackId, version: SemVer) {
    const v = formatSemVer(version);
    super(`Pack version not found: ${packId}@${v}`);
    this.packId = packId;
    this.version = v;
  }
}

export class InMemoryPackRegistry implements PackRegistry {
  private readonly byId = new Map<string, Map<string, PackManifestV1>>();

  public add(manifest: PackManifestV1): void {
    const id = String(manifest.id);
    const version = formatSemVer(manifest.version);

    const versions = this.byId.get(id) ?? new Map<string, PackManifestV1>();
    versions.set(version, manifest);
    this.byId.set(id, versions);
  }

  public listPackVersions(packId: PackId): readonly SemVer[] {
    const versions = this.byId.get(String(packId));
    if (!versions) throw new PackNotFoundError(packId);
    return [...versions.values()].map((m) => m.version);
  }

  public readPackManifest(packId: PackId, version: SemVer): PackManifestV1 {
    const versions = this.byId.get(String(packId));
    if (!versions) throw new PackNotFoundError(packId);
    const manifest = versions.get(formatSemVer(version));
    if (!manifest) throw new PackVersionNotFoundError(packId, version);
    return manifest;
  }
}
