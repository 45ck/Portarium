import { PackId } from '../primitives/index.js';
import type { SemVer } from '../versioning/semver.js';
import { parseSemVer } from '../versioning/semver.js';
import type { SemVerRange } from '../versioning/semver-range.js';
import { parseSemVerRange } from '../versioning/semver-range.js';

export type PackKind = 'VerticalPack' | 'BasePack' | 'ConnectorModule';

export type PackAssets = Readonly<{
  schemas?: readonly string[];
  workflows?: readonly string[];
  uiTemplates?: readonly string[];
  mappings?: readonly string[];
  testAssets?: readonly string[];
}>;

export type PackManifestV1 = Readonly<{
  manifestVersion: 1;
  kind: PackKind;
  id: PackId;
  version: SemVer;
  requiresCore: SemVerRange;
  displayName: string;
  description?: string;
  dependencies?: Readonly<Record<string, SemVerRange>>;
  assets: PackAssets;
}>;

export class PackManifestParseError extends Error {
  public override readonly name = 'PackManifestParseError';

  public constructor(message: string) {
    super(message);
  }
}

const PACK_ID_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

export function parsePackManifestV1(value: unknown): PackManifestV1 {
  if (!isRecord(value)) {
    throw new PackManifestParseError('Pack manifest must be an object.');
  }

  const manifestVersion = readNumber(value, 'manifestVersion');
  if (manifestVersion !== 1) {
    throw new PackManifestParseError(`Unsupported manifestVersion: ${manifestVersion}`);
  }

  const kind = readString(value, 'kind');
  if (!isPackKind(kind)) {
    throw new PackManifestParseError(`Unsupported pack kind: "${kind}"`);
  }

  const idRaw = readString(value, 'id');
  if (!PACK_ID_RE.test(idRaw)) {
    throw new PackManifestParseError(
      `Invalid pack id "${idRaw}". Expected a lowercase, dot-namespaced identifier (e.g. "scm.change-management").`,
    );
  }

  const versionRaw = readString(value, 'version');
  const version = parseSemVer(versionRaw);

  const requiresCoreRaw = readString(value, 'requiresCore');
  const requiresCore = parseSemVerRange(requiresCoreRaw);

  const displayName = readString(value, 'displayName');
  const description = readOptionalString(value, 'description');

  const dependenciesRaw = value['dependencies'];
  const dependencies =
    dependenciesRaw === undefined ? undefined : parseDependencies(dependenciesRaw);

  const assetsRaw = value['assets'];
  const assets = parseAssets(assetsRaw);

  return {
    manifestVersion: 1,
    kind,
    id: PackId(idRaw),
    version,
    requiresCore,
    displayName,
    ...(description ? { description } : {}),
    ...(dependencies ? { dependencies } : {}),
    assets,
  };
}

function parseDependencies(value: unknown): Readonly<Record<string, SemVerRange>> {
  if (!isRecord(value)) {
    throw new PackManifestParseError(
      'dependencies must be an object mapping packId -> semver range.',
    );
  }

  const out: Record<string, SemVerRange> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!PACK_ID_RE.test(k)) {
      throw new PackManifestParseError(`Invalid dependency pack id "${k}".`);
    }
    if (typeof v !== 'string') {
      throw new PackManifestParseError(`Invalid dependency range for "${k}". Expected string.`);
    }
    out[k] = parseSemVerRange(v);
  }
  return out;
}

function parseAssets(value: unknown): PackAssets {
  if (!isRecord(value)) {
    throw new PackManifestParseError('assets must be an object.');
  }

  const schemas = readOptionalStringArray(value, 'schemas');
  const workflows = readOptionalStringArray(value, 'workflows');
  const uiTemplates = readOptionalStringArray(value, 'uiTemplates');
  const mappings = readOptionalStringArray(value, 'mappings');
  const testAssets = readOptionalStringArray(value, 'testAssets');

  const out: {
    schemas?: readonly string[];
    workflows?: readonly string[];
    uiTemplates?: readonly string[];
    mappings?: readonly string[];
    testAssets?: readonly string[];
  } = {};

  if (schemas !== undefined) out.schemas = schemas;
  if (workflows !== undefined) out.workflows = workflows;
  if (uiTemplates !== undefined) out.uiTemplates = uiTemplates;
  if (mappings !== undefined) out.mappings = mappings;
  if (testAssets !== undefined) out.testAssets = testAssets;

  return out;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackManifestParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackManifestParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackManifestParseError(`${key} must be an integer.`);
  }
  return v;
}

function readOptionalStringArray(
  obj: Record<string, unknown>,
  key: string,
): readonly string[] | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.trim() === '')) {
    throw new PackManifestParseError(`${key} must be an array of non-empty strings when provided.`);
  }
  return v as readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPackKind(kind: string): kind is PackKind {
  return kind === 'VerticalPack' || kind === 'BasePack' || kind === 'ConnectorModule';
}
