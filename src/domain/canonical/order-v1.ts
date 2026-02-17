import {
  OrderId,
  TenantId,
  type OrderId as OrderIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const ORDER_STATUSES = ['draft', 'confirmed', 'fulfilled', 'cancelled'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderV1 = Readonly<{
  orderId: OrderIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  currencyCode: string;
  lineItemCount?: number;
  createdAtIso: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class OrderParseError extends Error {
  public override readonly name = 'OrderParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseOrderV1(value: unknown): OrderV1 {
  if (!isRecord(value)) {
    throw new OrderParseError('Order must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new OrderParseError('schemaVersion must be 1.');
  }

  const orderId = OrderId(readString(value, 'orderId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const orderNumber = readString(value, 'orderNumber');
  const status = readEnum(value, 'status', ORDER_STATUSES);
  const totalAmount = readNonNegativeNumber(value, 'totalAmount');
  const currencyCode = readCurrencyCode(value, 'currencyCode');
  const lineItemCount = readOptionalNonNegativeInteger(value, 'lineItemCount');
  const createdAtIso = readString(value, 'createdAtIso');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    orderId,
    tenantId,
    schemaVersion: 1,
    orderNumber,
    status,
    totalAmount,
    currencyCode,
    ...(lineItemCount !== undefined ? { lineItemCount } : {}),
    createdAtIso,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new OrderParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new OrderParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
}

function readNonNegativeNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new OrderParseError(`${key} must be a non-negative number.`);
  }
  return v;
}

function readOptionalNonNegativeInteger(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new OrderParseError(`${key} must be a non-negative integer when provided.`);
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
    throw new OrderParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new OrderParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
