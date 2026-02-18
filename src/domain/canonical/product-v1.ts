import {
  ProductId,
  TenantId,
  type ProductId as ProductIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readBoolean,
  readInteger,
  readOptionalNonNegativeNumber,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type ProductV1 = Readonly<{
  productId: ProductIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  name: string;
  sku?: string;
  active: boolean;
  unitPrice?: number;
  currencyCode?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class ProductParseError extends Error {
  public override readonly name = 'ProductParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseProductV1(value: unknown): ProductV1 {
  const record = readRecord(value, 'Product', ProductParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ProductParseError);
  if (schemaVersion !== 1) {
    throw new ProductParseError('schemaVersion must be 1.');
  }

  const productId = ProductId(readString(record, 'productId', ProductParseError));
  const tenantId = TenantId(readString(record, 'tenantId', ProductParseError));
  const name = readString(record, 'name', ProductParseError);
  const sku = readOptionalString(record, 'sku', ProductParseError);
  const active = readBoolean(record, 'active', ProductParseError);
  const unitPrice = readOptionalNonNegativeNumber(record, 'unitPrice', ProductParseError);
  const currencyCode = readOptionalCurrencyCode(record, 'currencyCode');
  const externalRefs = readOptionalExternalRefs(record);

  return {
    productId,
    tenantId,
    schemaVersion: 1,
    name,
    ...(sku ? { sku } : {}),
    active,
    ...(unitPrice !== undefined ? { unitPrice } : {}),
    ...(currencyCode ? { currencyCode } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalCurrencyCode(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new ProductParseError(`${key} must be a 3-letter uppercase currency code when provided.`);
  }
  return v;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new ProductParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
