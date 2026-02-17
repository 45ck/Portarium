import {
  PackId,
  TenantConfigId,
  TenantId,
  WorkspaceId,
  type PackId as PackIdType,
  type TenantConfigId as TenantConfigIdType,
  type TenantId as TenantIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import type { SemVer } from '../versioning/semver.js';
import { parseSemVer } from '../versioning/semver.js';

export type EnabledPackV1 = Readonly<{
  packId: PackIdType;
  version: SemVer;
}>;

export type FeatureFlagV1 = Readonly<{
  flagName: string;
  enabled: boolean;
}>;

export type TenantConfigV1 = Readonly<{
  schemaVersion: 1;
  tenantConfigId: TenantConfigIdType;
  tenantId: TenantIdType;
  workspaceId: WorkspaceIdType;
  enabledPacks: readonly EnabledPackV1[];
  featureFlags: readonly FeatureFlagV1[];
  complianceProfiles?: readonly string[];
  updatedAtIso: string;
}>;

export class TenantConfigParseError extends Error {
  public override readonly name = 'TenantConfigParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseTenantConfigV1(value: unknown): TenantConfigV1 {
  if (!isRecord(value)) throw new TenantConfigParseError('TenantConfig must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new TenantConfigParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const tenantConfigId = TenantConfigId(readString(value, 'tenantConfigId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));

  const enabledPacks = parseEnabledPacks(value['enabledPacks']);
  const featureFlags = parseFeatureFlags(value['featureFlags']);
  const complianceProfiles = parseComplianceProfiles(value['complianceProfiles']);

  const updatedAtIso = readString(value, 'updatedAtIso');
  parseIsoString(updatedAtIso, 'updatedAtIso');

  return {
    schemaVersion: 1,
    tenantConfigId,
    tenantId,
    workspaceId,
    enabledPacks,
    featureFlags,
    ...(complianceProfiles !== undefined ? { complianceProfiles } : {}),
    updatedAtIso,
  };
}

function parseEnabledPacks(raw: unknown): readonly EnabledPackV1[] {
  if (!Array.isArray(raw)) {
    throw new TenantConfigParseError('enabledPacks must be an array.');
  }

  return raw.map((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new TenantConfigParseError(`enabledPacks[${i}] must be an object.`);
    }

    const packId = PackId(readPackString(item, 'packId', i));
    const versionRaw = readPackString(item, 'version', i);

    let version: SemVer;
    try {
      version = parseSemVer(versionRaw);
    } catch {
      throw new TenantConfigParseError(`enabledPacks[${i}].version is not a valid SemVer string.`);
    }

    return { packId, version };
  });
}

function parseFeatureFlags(raw: unknown): readonly FeatureFlagV1[] {
  if (!Array.isArray(raw)) {
    throw new TenantConfigParseError('featureFlags must be an array.');
  }

  return raw.map((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new TenantConfigParseError(`featureFlags[${i}] must be an object.`);
    }

    const flagName = readFlagString(item, 'flagName', i);

    if (typeof item['enabled'] !== 'boolean') {
      throw new TenantConfigParseError(`featureFlags[${i}].enabled must be a boolean.`);
    }
    const enabled: boolean = item['enabled'];

    return { flagName, enabled };
  });
}

function parseComplianceProfiles(raw: unknown): readonly string[] | undefined {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    throw new TenantConfigParseError('complianceProfiles must be an array when provided.');
  }

  return raw.map((item: unknown, i: number) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new TenantConfigParseError(`complianceProfiles[${i}] must be a non-empty string.`);
    }
    return item;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TenantConfigParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new TenantConfigParseError(`${key} must be an integer.`);
  }
  return v;
}

function readPackString(obj: Record<string, unknown>, key: string, index: number): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TenantConfigParseError(`enabledPacks[${index}].${key} must be a non-empty string.`);
  }
  return v;
}

function readFlagString(obj: Record<string, unknown>, key: string, index: number): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new TenantConfigParseError(`featureFlags[${index}].${key} must be a non-empty string.`);
  }
  return v;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TenantConfigParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
