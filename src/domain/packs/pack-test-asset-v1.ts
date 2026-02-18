import { PackId, type PackId as PackIdType } from '../primitives/index.js';
import { readInteger, readRecord, readString } from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PackTestAssetV1 = Readonly<{
  schemaVersion: 1;
  assetId: string;
  packId: PackIdType;
  kind: string;
  dataPath: string;
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackTestAssetParseError extends Error {
  public override readonly name = 'PackTestAssetParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parsePackTestAssetV1(value: unknown): PackTestAssetV1 {
  const record = readRecord(value, 'Pack test asset', PackTestAssetParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackTestAssetParseError);
  if (schemaVersion !== 1) {
    throw new PackTestAssetParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const assetId = readString(record, 'assetId', PackTestAssetParseError);
  const packId = readString(record, 'packId', PackTestAssetParseError);
  const kind = readString(record, 'kind', PackTestAssetParseError);
  const dataPath = readString(record, 'dataPath', PackTestAssetParseError);

  return {
    schemaVersion: 1,
    assetId,
    packId: PackId(packId),
    kind,
    dataPath,
  };
}
