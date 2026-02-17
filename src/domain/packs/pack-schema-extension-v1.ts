import {
  PackId,
  SchemaExtensionId,
  type PackId as PackIdType,
  type SchemaExtensionId as SchemaExtensionIdType,
} from '../primitives/index.js';
import type { CoreExtensionPoint } from './core-extension-points.js';
import { isCoreExtensionPoint } from './core-extension-points.js';

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
  if (!isRecord(value)) {
    throw new PackSchemaExtensionParseError('Pack schema extension must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackSchemaExtensionParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const extensionId = readString(value, 'extensionId');
  const packId = readString(value, 'packId');
  const namespace = readString(value, 'namespace');

  const extendsCore = readString(value, 'extendsCore');
  if (!isCoreExtensionPoint(extendsCore)) {
    throw new PackSchemaExtensionParseError(
      `Invalid extendsCore value: "${extendsCore}". Must be a core extension point.`,
    );
  }

  const fieldsRaw = value['fields'];
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
  if (!isRecord(value)) {
    throw new PackSchemaExtensionParseError(`fields[${index}] must be an object.`);
  }

  const fieldName = readString(value, 'fieldName');
  const fieldType = readString(value, 'fieldType');
  const required = readBoolean(value, 'required');
  const description = readOptionalString(value, 'description');

  return {
    fieldName,
    fieldType,
    required,
    ...(description !== undefined ? { description } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackSchemaExtensionParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackSchemaExtensionParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackSchemaExtensionParseError(`${key} must be an integer.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new PackSchemaExtensionParseError(`${key} must be a boolean.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
