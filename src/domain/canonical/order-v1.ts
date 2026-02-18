import {
  OrderId,
  TenantId,
  type OrderId as OrderIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readIsoString,
  readNonNegativeNumber,
  readOptionalNonNegativeInteger,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Order', OrderParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', OrderParseError);
  if (schemaVersion !== 1) {
    throw new OrderParseError('schemaVersion must be 1.');
  }

  const orderId = OrderId(readString(record, 'orderId', OrderParseError));
  const tenantId = TenantId(readString(record, 'tenantId', OrderParseError));
  const orderNumber = readString(record, 'orderNumber', OrderParseError);
  const status = readEnum(record, 'status', ORDER_STATUSES, OrderParseError);
  const totalAmount = readNonNegativeNumber(record, 'totalAmount', OrderParseError);
  const currencyCode = readCurrencyCode(record, 'currencyCode');
  const lineItemCount = readOptionalNonNegativeInteger(record, 'lineItemCount', OrderParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', OrderParseError);
  const externalRefs = readOptionalExternalRefs(record);

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

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new OrderParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
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
