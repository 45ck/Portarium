import {
  PaymentId,
  TenantId,
  type PaymentId as PaymentIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new PaymentParseError('Payment must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new PaymentParseError('schemaVersion must be 1.');
  }

  const paymentId = PaymentId(readString(value, 'paymentId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const amount = readNonNegativeNumber(value, 'amount');
  const currencyCode = readCurrencyCode(value, 'currencyCode');
  const status = readEnum(value, 'status', PAYMENT_STATUSES);
  const paidAtIso = readOptionalString(value, 'paidAtIso');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PaymentParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PaymentParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new PaymentParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
}

function readNonNegativeNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new PaymentParseError(`${key} must be a non-negative number.`);
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
    throw new PaymentParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
