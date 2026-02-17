import {
  InvoiceId,
  TenantId,
  type InvoiceId as InvoiceIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void', 'overdue'] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceV1 = Readonly<{
  invoiceId: InvoiceIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  invoiceNumber: string;
  status: InvoiceStatus;
  currencyCode: string;
  totalAmount: number;
  issuedAtIso: string;
  dueDateIso?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class InvoiceParseError extends Error {
  public override readonly name = 'InvoiceParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseInvoiceV1(value: unknown): InvoiceV1 {
  if (!isRecord(value)) {
    throw new InvoiceParseError('Invoice must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new InvoiceParseError('schemaVersion must be 1.');
  }

  const invoiceId = InvoiceId(readString(value, 'invoiceId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const invoiceNumber = readString(value, 'invoiceNumber');
  const status = readEnum(value, 'status', INVOICE_STATUSES);
  const currencyCode = readCurrencyCode(value, 'currencyCode');
  const totalAmount = readNonNegativeNumber(value, 'totalAmount');
  const issuedAtIso = readString(value, 'issuedAtIso');
  const dueDateIso = readOptionalString(value, 'dueDateIso');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    invoiceId,
    tenantId,
    schemaVersion: 1,
    invoiceNumber,
    status,
    currencyCode,
    totalAmount,
    issuedAtIso,
    ...(dueDateIso ? { dueDateIso } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new InvoiceParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new InvoiceParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new InvoiceParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
}

function readNonNegativeNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new InvoiceParseError(`${key} must be a non-negative number.`);
  }
  return v;
}

function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const v = obj[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new InvoiceParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new InvoiceParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
