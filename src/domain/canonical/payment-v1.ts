import {
  PaymentId,
  TenantId,
  type PaymentId as PaymentIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readNonNegativeNumber,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentV1 = Readonly<{
  paymentId: PaymentIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  amount: number;
  currencyCode: string;
  status: PaymentStatus;
  paidAtIso?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class PaymentParseError extends Error {
  public override readonly name = 'PaymentParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePaymentV1(value: unknown): PaymentV1 {
  const record = readRecord(value, 'Payment', PaymentParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PaymentParseError);
  if (schemaVersion !== 1) {
    throw new PaymentParseError('schemaVersion must be 1.');
  }

  const paymentId = PaymentId(readString(record, 'paymentId', PaymentParseError));
  const tenantId = TenantId(readString(record, 'tenantId', PaymentParseError));
  const amount = readNonNegativeNumber(record, 'amount', PaymentParseError);
  const currencyCode = readCurrencyCode(record, 'currencyCode');
  const status = readEnum(record, 'status', PAYMENT_STATUSES, PaymentParseError);
  const paidAtIso = readOptionalIsoString(record, 'paidAtIso', PaymentParseError);
  const externalRefs = readOptionalExternalRefs(record);

  return {
    paymentId,
    tenantId,
    schemaVersion: 1,
    amount,
    currencyCode,
    status,
    ...(paidAtIso ? { paidAtIso } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new PaymentParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new PaymentParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
