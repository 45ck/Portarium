import {
  AssetId,
  TenantId,
  type AssetId as AssetIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const ASSET_STATUSES = ['active', 'inactive', 'retired', 'maintenance'] as const;
type AssetStatus = (typeof ASSET_STATUSES)[number];

export type AssetV1 = Readonly<{
  assetId: AssetIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  name: string;
  assetType: string;
  serialNumber?: string;
  status: AssetStatus;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class AssetParseError extends Error {
  public override readonly name = 'AssetParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseAssetV1(value: unknown): AssetV1 {
  if (!isRecord(value)) {
    throw new AssetParseError('Asset must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new AssetParseError('schemaVersion must be 1.');
  }

  const assetId = AssetId(readString(value, 'assetId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const name = readString(value, 'name');
  const assetType = readString(value, 'assetType');
  const serialNumber = readOptionalString(value, 'serialNumber');
  const status = readEnum(value, 'status', ASSET_STATUSES);
  const externalRefs = readOptionalExternalRefs(value);

  return {
    assetId,
    tenantId,
    schemaVersion: 1,
    name,
    assetType,
    ...(serialNumber ? { serialNumber } : {}),
    status,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AssetParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AssetParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const v = obj[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new AssetParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new AssetParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
