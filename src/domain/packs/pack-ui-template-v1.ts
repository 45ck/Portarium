import {
  PackId,
  UiTemplateId,
  type PackId as PackIdType,
  type UiTemplateId as UiTemplateIdType,
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
  const record = readRecord(value, 'Pack UI template', PackUiTemplateParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackUiTemplateParseError);
  if (schemaVersion !== 1) {
    throw new PackUiTemplateParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const templateId = readString(record, 'templateId', PackUiTemplateParseError);
  const packId = readString(record, 'packId', PackUiTemplateParseError);
  const namespace = readString(record, 'namespace', PackUiTemplateParseError);
  const schemaRef = readString(record, 'schemaRef', PackUiTemplateParseError);

  const fieldsRaw = record['fields'];
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
  const record = readRecord(value, `fields[${index}]`, PackUiTemplateParseError);

  const fieldName = readString(record, 'fieldName', PackUiTemplateParseError);
  const widget = readString(record, 'widget', PackUiTemplateParseError);
  const label = readOptionalString(record, 'label', PackUiTemplateParseError);

  return {
    fieldName,
    widget,
    ...(label !== undefined ? { label } : {}),
  };
}
