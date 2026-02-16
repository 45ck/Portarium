import { PackId } from '../primitives/index.js';
import type { SemVer } from '../versioning/semver.js';
import { compareSemVer, formatSemVer } from '../versioning/semver.js';
import type { SemVerRange } from '../versioning/semver-range.js';
import { formatSemVerRange, satisfiesSemVerRange } from '../versioning/semver-range.js';
import type { PackManifestV1 } from './pack-manifest.js';
import type { PackRegistry } from './pack-registry.js';

export type PackLockfileV1 = Readonly<{
  lockfileVersion: 1;
  coreVersion: SemVer;
  generatedAt: string;
  packs: readonly PackLockfileEntryV1[];
}>;

export type PackLockfileEntryV1 = Readonly<{
  id: PackId;
  version: SemVer;
}>;

export type PackRequest = Readonly<{
  id: PackId;
  // Range syntax is intentionally limited (see SemVerRange).
  range: SemVerRange;
}>;

export class PackResolutionError extends Error {
  public override readonly name: string = 'PackResolutionError';
}

export class PackCoreCompatibilityError extends PackResolutionError {
  public override readonly name: string = 'PackCoreCompatibilityError';
  public readonly packId: PackId;
  public readonly packVersion: string;

  public constructor(packId: PackId, packVersion: SemVer) {
    super(`Pack is incompatible with this core version: ${packId}@${formatSemVer(packVersion)}`);
    this.packId = packId;
    this.packVersion = formatSemVer(packVersion);
  }
}

export class PackNoSatisfyingVersionError extends PackResolutionError {
  public override readonly name: string = 'PackNoSatisfyingVersionError';
  public readonly packId: PackId;

  public constructor(packId: PackId) {
    super(`No satisfying version found for pack: ${packId}`);
    this.packId = packId;
  }
}

export class PackDependencyConflictError extends PackResolutionError {
  public override readonly name: string = 'PackDependencyConflictError';
  public readonly packId: PackId;

  public constructor(packId: PackId, message: string) {
    super(`Dependency conflict for ${packId}: ${message}`);
    this.packId = packId;
  }
}

export function resolvePacksV1(params: {
  coreVersion: SemVer;
  requests: readonly PackRequest[];
  registry: PackRegistry;
  now?: Date;
}): PackLockfileV1 {
  const nowIso = (params.now ?? new Date()).toISOString();
  const constraints = buildConstraintMap(params.requests);

  const resolved = new Map<string, PackManifestV1>();
  const queue = [...new Set(params.requests.map((r) => String(r.id)))];

  while (queue.length > 0) {
    const idRaw = queue.shift();
    if (!idRaw) continue;

    const packId = PackId(idRaw);
    if (resolved.has(idRaw)) continue;

    const ranges = constraints.get(idRaw) ?? [];
    const manifest = pickBestManifest({
      packId,
      ranges,
      coreVersion: params.coreVersion,
      registry: params.registry,
    });

    resolved.set(idRaw, manifest);

    const deps = manifest.dependencies ? Object.entries(manifest.dependencies) : [];
    for (const [depIdRaw, depRange] of deps) {
      addConstraint(constraints, depIdRaw, depRange);

      const depResolved = resolved.get(depIdRaw);
      if (depResolved && !satisfiesSemVerRange(depResolved.version, depRange)) {
        throw new PackDependencyConflictError(
          PackId(depIdRaw),
          `resolved to ${formatSemVer(depResolved.version)} but required ${formatSemVerRange(depRange)}`,
        );
      }

      queue.push(depIdRaw);
    }
  }

  assertNoCycles(resolved);

  return {
    lockfileVersion: 1,
    coreVersion: params.coreVersion,
    generatedAt: nowIso,
    packs: [...resolved.values()]
      .map((m) => ({ id: m.id, version: m.version }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
}

function buildConstraintMap(requests: readonly PackRequest[]): Map<string, SemVerRange[]> {
  const m = new Map<string, SemVerRange[]>();
  for (const r of requests) addConstraint(m, String(r.id), r.range);
  return m;
}

function addConstraint(m: Map<string, SemVerRange[]>, packIdRaw: string, range: SemVerRange): void {
  const existing = m.get(packIdRaw) ?? [];
  existing.push(range);
  m.set(packIdRaw, existing);
}

function pickBestManifest(params: {
  packId: PackId;
  ranges: readonly SemVerRange[];
  coreVersion: SemVer;
  registry: PackRegistry;
}): PackManifestV1 {
  const versions = [...params.registry.listPackVersions(params.packId)].sort((a, b) =>
    compareSemVer(b, a),
  );

  for (const v of versions) {
    if (!params.ranges.every((r) => satisfiesSemVerRange(v, r))) continue;
    const manifest = params.registry.readPackManifest(params.packId, v);
    if (!satisfiesSemVerRange(params.coreVersion, manifest.requiresCore)) continue;
    return manifest;
  }

  // Give a more specific error if versions exist but core is incompatible.
  if (versions.some((v) => params.ranges.every((r) => satisfiesSemVerRange(v, r)))) {
    const best = versions.find((v) => params.ranges.every((r) => satisfiesSemVerRange(v, r)));
    if (best) throw new PackCoreCompatibilityError(params.packId, best);
  }

  throw new PackNoSatisfyingVersionError(params.packId);
}

function assertNoCycles(resolved: Map<string, PackManifestV1>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const id of resolved.keys()) {
    visit(id, resolved, visiting, visited);
  }
}

function visit(
  id: string,
  resolved: Map<string, PackManifestV1>,
  visiting: Set<string>,
  visited: Set<string>,
): void {
  if (visited.has(id)) return;
  if (visiting.has(id)) {
    throw new PackResolutionError(`Dependency cycle detected at pack: ${id}`);
  }

  visiting.add(id);
  const manifest = resolved.get(id);
  const deps = manifest?.dependencies ? Object.keys(manifest.dependencies) : [];
  for (const depId of deps) visit(depId, resolved, visiting, visited);
  visiting.delete(id);
  visited.add(id);
}
