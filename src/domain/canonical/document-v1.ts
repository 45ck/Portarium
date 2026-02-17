import {
  DocumentId,
  TenantId,
  type DocumentId as DocumentIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new DocumentParseError('Document must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new DocumentParseError('schemaVersion must be 1.');
  }

  const documentId = DocumentId(readString(value, 'documentId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const title = readString(value, 'title');
  const mimeType = readString(value, 'mimeType');
  const sizeBytes = readOptionalNonNegativeNumber(value, 'sizeBytes');
  const storagePath = readOptionalString(value, 'storagePath');
  const createdAtIso = readString(value, 'createdAtIso');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new DocumentParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new DocumentParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readOptionalNonNegativeNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new DocumentParseError(`${key} must be a non-negative number when provided.`);
  }
  return v;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
