import { PackId } from '../primitives/index.js';
import type { SemVer } from '../versioning/semver.js';
import { parseSemVer } from '../versioning/semver.js';
import type { SemVerRange } from '../versioning/semver-range.js';
import { parseSemVerRange } from '../versioning/semver-range.js';
import {
  parseRecord,
  readInteger,
  readOptionalString,
  readOptionalStringArray,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type PackKind = 'VerticalPack' | 'BasePack' | 'ConnectorModule';

export type PackAssets = Readonly<{
  schemas?: readonly string[];
  workflows?: readonly string[];
  uiTemplates?: readonly string[];
  mappings?: readonly string[];
  testAssets?: readonly string[];
  complianceProfiles?: readonly string[];
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
  const record = readRecord(value, 'Pack manifest', PackManifestParseError);

  const manifestVersion = readInteger(record, 'manifestVersion', PackManifestParseError);
  if (manifestVersion !== 1) {
    throw new PackManifestParseError(`Unsupported manifestVersion: ${manifestVersion}`);
  }

  const kind = readString(record, 'kind', PackManifestParseError);
  if (!isPackKind(kind)) {
    throw new PackManifestParseError(`Unsupported pack kind: "${kind}"`);
  }

  const idRaw = readString(record, 'id', PackManifestParseError);
  if (!PACK_ID_RE.test(idRaw)) {
    throw new PackManifestParseError(
      `Invalid pack id "${idRaw}". Expected a lowercase, dot-namespaced identifier (e.g. "scm.change-management").`,
    );
  }

  const versionRaw = readString(record, 'version', PackManifestParseError);
  const version = parseSemVer(versionRaw);

  const requiresCoreRaw = readString(record, 'requiresCore', PackManifestParseError);
  const requiresCore = parseSemVerRange(requiresCoreRaw);

  const displayName = readString(record, 'displayName', PackManifestParseError);
  const description = readOptionalString(record, 'description', PackManifestParseError);

  const dependenciesRaw = record['dependencies'];
  const dependencies =
    dependenciesRaw === undefined ? undefined : parseDependencies(dependenciesRaw);

  const assetsRaw = record['assets'];
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
  const record = parseRecord(value, 'dependencies', PackManifestParseError);

  const out: Record<string, SemVerRange> = {};
  for (const [k, v] of Object.entries(record)) {
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
  const record = parseRecord(value, 'assets', PackManifestParseError);

  const schemas = readOptionalStringArray(record, 'schemas', PackManifestParseError);
  const workflows = readOptionalStringArray(record, 'workflows', PackManifestParseError);
  const uiTemplates = readOptionalStringArray(record, 'uiTemplates', PackManifestParseError);
  const mappings = readOptionalStringArray(record, 'mappings', PackManifestParseError);
  const testAssets = readOptionalStringArray(record, 'testAssets', PackManifestParseError);
  const complianceProfiles = readOptionalStringArray(
    record,
    'complianceProfiles',
    PackManifestParseError,
  );

  const out: {
    schemas?: readonly string[];
    workflows?: readonly string[];
    uiTemplates?: readonly string[];
    mappings?: readonly string[];
    testAssets?: readonly string[];
    complianceProfiles?: readonly string[];
  } = {};

  if (schemas !== undefined) out.schemas = schemas;
  if (workflows !== undefined) out.workflows = workflows;
  if (uiTemplates !== undefined) out.uiTemplates = uiTemplates;
  if (mappings !== undefined) out.mappings = mappings;
  if (testAssets !== undefined) out.testAssets = testAssets;
  if (complianceProfiles !== undefined) out.complianceProfiles = complianceProfiles;

  return out;
}

function isPackKind(kind: string): kind is PackKind {
  return kind === 'VerticalPack' || kind === 'BasePack' || kind === 'ConnectorModule';
}
