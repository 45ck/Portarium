import { PackId, type PackId as PackIdType } from '../primitives/index.js';

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
  if (!isRecord(value)) {
    throw new PackTestAssetParseError('Pack test asset must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackTestAssetParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const assetId = readString(value, 'assetId');
  const packId = readString(value, 'packId');
  const kind = readString(value, 'kind');
  const dataPath = readString(value, 'dataPath');

  return {
    schemaVersion: 1,
    assetId,
    packId: PackId(packId),
    kind,
    dataPath,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackTestAssetParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackTestAssetParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
