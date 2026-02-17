import {
  FinancialAccountId,
  TenantId,
  type FinancialAccountId as FinancialAccountIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

export type AccountV1 = Readonly<{
  accountId: FinancialAccountIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  accountName: string;
  accountCode: string;
  accountType: AccountType;
  currencyCode: string;
  isActive: boolean;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class AccountParseError extends Error {
  public override readonly name = 'AccountParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseAccountV1(value: unknown): AccountV1 {
  if (!isRecord(value)) {
    throw new AccountParseError('Account must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new AccountParseError('schemaVersion must be 1.');
  }

  const accountId = FinancialAccountId(readString(value, 'accountId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const accountName = readString(value, 'accountName');
  const accountCode = readString(value, 'accountCode');
  const accountType = readEnum(value, 'accountType', ACCOUNT_TYPES);
  const currencyCode = readCurrencyCode(value, 'currencyCode');
  const isActive = readBoolean(value, 'isActive');
  const externalRefs = readOptionalExternalRefs(value);

  return {
    accountId,
    tenantId,
    schemaVersion: 1,
    accountName,
    accountCode,
    accountType,
    currencyCode,
    isActive,
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AccountParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new AccountParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new AccountParseError(`${key} must be a boolean.`);
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
    throw new AccountParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new AccountParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
