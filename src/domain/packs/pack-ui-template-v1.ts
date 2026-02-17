import {
  PackId,
  UiTemplateId,
  type PackId as PackIdType,
  type UiTemplateId as UiTemplateIdType,
} from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UiFieldHintV1 = Readonly<{
  fieldName: string;
  widget: string;
  label?: string;
}>;

export type PackUiTemplateV1 = Readonly<{
  schemaVersion: 1;
  templateId: UiTemplateIdType;
  packId: PackIdType;
  namespace: string;
  schemaRef: string;
  fields: readonly UiFieldHintV1[];
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackUiTemplateParseError extends Error {
  public override readonly name = 'PackUiTemplateParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parsePackUiTemplateV1(value: unknown): PackUiTemplateV1 {
  if (!isRecord(value)) {
    throw new PackUiTemplateParseError('Pack UI template must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackUiTemplateParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const templateId = readString(value, 'templateId');
  const packId = readString(value, 'packId');
  const namespace = readString(value, 'namespace');
  const schemaRef = readString(value, 'schemaRef');

  const fieldsRaw = value['fields'];
  if (!Array.isArray(fieldsRaw)) {
    throw new PackUiTemplateParseError('fields must be an array.');
  }
  const fields = fieldsRaw.map((f, i) => parseUiFieldHint(f, i));

  return {
    schemaVersion: 1,
    templateId: UiTemplateId(templateId),
    packId: PackId(packId),
    namespace,
    schemaRef,
    fields,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseUiFieldHint(value: unknown, index: number): UiFieldHintV1 {
  if (!isRecord(value)) {
    throw new PackUiTemplateParseError(`fields[${index}] must be an object.`);
  }

  const fieldName = readString(value, 'fieldName');
  const widget = readString(value, 'widget');
  const label = readOptionalString(value, 'label');

  return {
    fieldName,
    widget,
    ...(label !== undefined ? { label } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackUiTemplateParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackUiTemplateParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackUiTemplateParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
