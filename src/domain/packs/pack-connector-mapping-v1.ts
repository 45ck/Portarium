import {
  ConnectorMappingId,
  PackId,
  type ConnectorMappingId as ConnectorMappingIdType,
  type PackId as PackIdType,
} from '../primitives/index.js';
import {
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Pack connector mapping', PackConnectorMappingParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackConnectorMappingParseError);
  if (schemaVersion !== 1) {
    throw new PackConnectorMappingParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const mappingId = readString(record, 'mappingId', PackConnectorMappingParseError);
  const packId = readString(record, 'packId', PackConnectorMappingParseError);
  const namespace = readString(record, 'namespace', PackConnectorMappingParseError);
  const protocol = readString(record, 'protocol', PackConnectorMappingParseError);
  const authModel = readString(record, 'authModel', PackConnectorMappingParseError);

  const fieldMappingsRaw = record['fieldMappings'];
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
  const record = readRecord(value, `fieldMappings[${index}]`, PackConnectorMappingParseError);

  const sourceField = readString(record, 'sourceField', PackConnectorMappingParseError);
  const targetField = readString(record, 'targetField', PackConnectorMappingParseError);
  const transform = readOptionalString(record, 'transform', PackConnectorMappingParseError);

  return {
    sourceField,
    targetField,
    ...(transform !== undefined ? { transform } : {}),
  };
}
