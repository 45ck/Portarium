import {
  InvoiceId,
  TenantId,
  type InvoiceId as InvoiceIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeNumber,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Invoice', InvoiceParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', InvoiceParseError);
  if (schemaVersion !== 1) {
    throw new InvoiceParseError('schemaVersion must be 1.');
  }

  const invoiceId = InvoiceId(readString(record, 'invoiceId', InvoiceParseError));
  const tenantId = TenantId(readString(record, 'tenantId', InvoiceParseError));
  const invoiceNumber = readString(record, 'invoiceNumber', InvoiceParseError);
  const status = readEnum(record, 'status', INVOICE_STATUSES, InvoiceParseError);
  const currencyCode = readCurrencyCode(record, 'currencyCode');
  const totalAmount = readNonNegativeNumber(record, 'totalAmount', InvoiceParseError);
  const issuedAtIso = readIsoString(record, 'issuedAtIso', InvoiceParseError);
  const dueDateIso = readOptionalIsoString(record, 'dueDateIso', InvoiceParseError);
  const externalRefs = readOptionalExternalRefs(record);

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

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new InvoiceParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
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
