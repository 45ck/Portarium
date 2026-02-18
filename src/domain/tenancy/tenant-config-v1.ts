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
import {
  parseBoolean,
  parseNonEmptyString,
  parseRecord,
  readInteger,
  readIsoString,
  readRecord,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'TenantConfig', TenantConfigParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', TenantConfigParseError);
  if (schemaVersion !== 1) {
    throw new TenantConfigParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const tenantConfigId = TenantConfigId(
    parseNonEmptyString(record['tenantConfigId'], 'tenantConfigId', TenantConfigParseError),
  );
  const tenantId = TenantId(
    parseNonEmptyString(record['tenantId'], 'tenantId', TenantConfigParseError),
  );
  const workspaceId = WorkspaceId(
    parseNonEmptyString(record['workspaceId'], 'workspaceId', TenantConfigParseError),
  );

  const enabledPacks = parseEnabledPacks(record['enabledPacks']);
  const featureFlags = parseFeatureFlags(record['featureFlags']);
  const complianceProfiles = parseComplianceProfiles(record['complianceProfiles']);

  const updatedAtIso = readIsoString(record, 'updatedAtIso', TenantConfigParseError);

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
    const record = parseRecord(item, `enabledPacks[${i}]`, TenantConfigParseError);

    const packId = PackId(
      parseNonEmptyString(record['packId'], `enabledPacks[${i}].packId`, TenantConfigParseError),
    );
    const versionRaw = parseNonEmptyString(
      record['version'],
      `enabledPacks[${i}].version`,
      TenantConfigParseError,
    );

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
    const record = parseRecord(item, `featureFlags[${i}]`, TenantConfigParseError);

    const flagName = parseNonEmptyString(
      record['flagName'],
      `featureFlags[${i}].flagName`,
      TenantConfigParseError,
    );
    const enabled = parseBoolean(
      record['enabled'],
      `featureFlags[${i}].enabled`,
      TenantConfigParseError,
    );

    return { flagName, enabled };
  });
}

function parseComplianceProfiles(raw: unknown): readonly string[] | undefined {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    throw new TenantConfigParseError('complianceProfiles must be an array when provided.');
  }

  return raw.map((item: unknown, i: number) => {
    return parseNonEmptyString(item, `complianceProfiles[${i}]`, TenantConfigParseError);
  });
}
