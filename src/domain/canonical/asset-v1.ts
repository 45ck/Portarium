import {
  AssetId,
  TenantId,
  type AssetId as AssetIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Asset', AssetParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', AssetParseError);
  if (schemaVersion !== 1) {
    throw new AssetParseError('schemaVersion must be 1.');
  }

  const assetId = AssetId(readString(record, 'assetId', AssetParseError));
  const tenantId = TenantId(readString(record, 'tenantId', AssetParseError));
  const name = readString(record, 'name', AssetParseError);
  const assetType = readString(record, 'assetType', AssetParseError);
  const serialNumber = readOptionalString(record, 'serialNumber', AssetParseError);
  const status = readEnum(record, 'status', ASSET_STATUSES, AssetParseError);
  const externalRefs = readOptionalExternalRefs(record);

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
