import {
  DocumentId,
  TenantId,
  type DocumentId as DocumentIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readInteger,
  readIsoString,
  readOptionalNonNegativeNumber,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type DocumentV1 = Readonly<{
  documentId: DocumentIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  title: string;
  mimeType: string;
  sizeBytes?: number;
  storagePath?: string;
  createdAtIso: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class DocumentParseError extends Error {
  public override readonly name = 'DocumentParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseDocumentV1(value: unknown): DocumentV1 {
  const record = readRecord(value, 'Document', DocumentParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', DocumentParseError);
  if (schemaVersion !== 1) {
    throw new DocumentParseError('schemaVersion must be 1.');
  }

  const documentId = DocumentId(readString(record, 'documentId', DocumentParseError));
  const tenantId = TenantId(readString(record, 'tenantId', DocumentParseError));
  const title = readString(record, 'title', DocumentParseError);
  const mimeType = readString(record, 'mimeType', DocumentParseError);
  const sizeBytes = readOptionalNonNegativeNumber(record, 'sizeBytes', DocumentParseError);
  const storagePath = readOptionalString(record, 'storagePath', DocumentParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', DocumentParseError);
  const externalRefs = readOptionalExternalRefs(record);

  return {
    documentId,
    tenantId,
    schemaVersion: 1,
    title,
    mimeType,
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    ...(storagePath ? { storagePath } : {}),
    createdAtIso,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new DocumentParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
