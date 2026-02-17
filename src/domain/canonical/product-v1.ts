import {
  ProductId,
  TenantId,
  type ProductId as ProductIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new ProductParseError('Product must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new ProductParseError('schemaVersion must be 1.');
  }

  const productId = ProductId(readString(value, 'productId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const name = readString(value, 'name');
  const sku = readOptionalString(value, 'sku');
  const active = readBoolean(value, 'active');
  const unitPrice = readOptionalNonNegativeNumber(value, 'unitPrice');
  const currencyCode = readOptionalCurrencyCode(value, 'currencyCode');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ProductParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ProductParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new ProductParseError(`${key} must be a boolean.`);
  }
  return v;
}

function readOptionalCurrencyCode(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new ProductParseError(`${key} must be a 3-letter uppercase currency code when provided.`);
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
    throw new ProductParseError(`${key} must be a non-negative number when provided.`);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
