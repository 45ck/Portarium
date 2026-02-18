import {
  PackId,
  SchemaExtensionId,
  type PackId as PackIdType,
  type SchemaExtensionId as SchemaExtensionIdType,
} from '../primitives/index.js';
import type { CoreExtensionPoint } from './core-extension-points.js';
import { isCoreExtensionPoint } from './core-extension-points.js';
import {
  readBoolean,
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchemaFieldV1 = Readonly<{
  fieldName: string;
  fieldType: string;
  required: boolean;
  description?: string;
}>;

export type PackSchemaExtensionV1 = Readonly<{
  schemaVersion: 1;
  extensionId: SchemaExtensionIdType;
  packId: PackIdType;
  namespace: string;
  extendsCore: CoreExtensionPoint;
  fields: readonly SchemaFieldV1[];
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackSchemaExtensionParseError extends Error {
  public override readonly name = 'PackSchemaExtensionParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parsePackSchemaExtensionV1(value: unknown): PackSchemaExtensionV1 {
  const record = readRecord(value, 'Pack schema extension', PackSchemaExtensionParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackSchemaExtensionParseError);
  if (schemaVersion !== 1) {
    throw new PackSchemaExtensionParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const extensionId = readString(record, 'extensionId', PackSchemaExtensionParseError);
  const packId = readString(record, 'packId', PackSchemaExtensionParseError);
  const namespace = readString(record, 'namespace', PackSchemaExtensionParseError);

  const extendsCore = readString(record, 'extendsCore', PackSchemaExtensionParseError);
  if (!isCoreExtensionPoint(extendsCore)) {
    throw new PackSchemaExtensionParseError(
      `Invalid extendsCore value: "${extendsCore}". Must be a core extension point.`,
    );
  }

  const fieldsRaw = record['fields'];
  if (!Array.isArray(fieldsRaw)) {
    throw new PackSchemaExtensionParseError('fields must be an array.');
  }
  const fields = fieldsRaw.map((f, i) => parseSchemaField(f, i));

  return {
    schemaVersion: 1,
    extensionId: SchemaExtensionId(extensionId),
    packId: PackId(packId),
    namespace,
    extendsCore,
    fields,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseSchemaField(value: unknown, index: number): SchemaFieldV1 {
  const record = readRecord(value, `fields[${index}]`, PackSchemaExtensionParseError);

  const fieldName = readString(record, 'fieldName', PackSchemaExtensionParseError);
  const fieldType = readString(record, 'fieldType', PackSchemaExtensionParseError);
  const required = readBoolean(record, 'required', PackSchemaExtensionParseError);
  const description = readOptionalString(record, 'description', PackSchemaExtensionParseError);

  return {
    fieldName,
    fieldType,
    required,
    ...(description !== undefined ? { description } : {}),
  };
}
