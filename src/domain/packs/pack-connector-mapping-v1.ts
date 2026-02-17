import {
  ConnectorMappingId,
  PackId,
  type ConnectorMappingId as ConnectorMappingIdType,
  type PackId as PackIdType,
} from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldMappingV1 = Readonly<{
  sourceField: string;
  targetField: string;
  transform?: string;
}>;

export type PackConnectorMappingV1 = Readonly<{
  schemaVersion: 1;
  mappingId: ConnectorMappingIdType;
  packId: PackIdType;
  namespace: string;
  protocol: string;
  authModel: string;
  fieldMappings: readonly FieldMappingV1[];
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackConnectorMappingParseError extends Error {
  public override readonly name = 'PackConnectorMappingParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parsePackConnectorMappingV1(value: unknown): PackConnectorMappingV1 {
  if (!isRecord(value)) {
    throw new PackConnectorMappingParseError('Pack connector mapping must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackConnectorMappingParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const mappingId = readString(value, 'mappingId');
  const packId = readString(value, 'packId');
  const namespace = readString(value, 'namespace');
  const protocol = readString(value, 'protocol');
  const authModel = readString(value, 'authModel');

  const fieldMappingsRaw = value['fieldMappings'];
  if (!Array.isArray(fieldMappingsRaw)) {
    throw new PackConnectorMappingParseError('fieldMappings must be an array.');
  }
  const fieldMappings = fieldMappingsRaw.map((fm, i) => parseFieldMapping(fm, i));

  return {
    schemaVersion: 1,
    mappingId: ConnectorMappingId(mappingId),
    packId: PackId(packId),
    namespace,
    protocol,
    authModel,
    fieldMappings,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseFieldMapping(value: unknown, index: number): FieldMappingV1 {
  if (!isRecord(value)) {
    throw new PackConnectorMappingParseError(`fieldMappings[${index}] must be an object.`);
  }

  const sourceField = readString(value, 'sourceField');
  const targetField = readString(value, 'targetField');
  const transform = readOptionalString(value, 'transform');

  return {
    sourceField,
    targetField,
    ...(transform !== undefined ? { transform } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackConnectorMappingParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackConnectorMappingParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackConnectorMappingParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
