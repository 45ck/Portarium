import {
  FinancialAccountId,
  TenantId,
  type FinancialAccountId as FinancialAccountIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readBoolean,
  readEnum,
  readInteger,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Account', AccountParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', AccountParseError);
  if (schemaVersion !== 1) {
    throw new AccountParseError('schemaVersion must be 1.');
  }

  const accountId = FinancialAccountId(readString(record, 'accountId', AccountParseError));
  const tenantId = TenantId(readString(record, 'tenantId', AccountParseError));
  const accountName = readString(record, 'accountName', AccountParseError);
  const accountCode = readString(record, 'accountCode', AccountParseError);
  const accountType = readEnum(record, 'accountType', ACCOUNT_TYPES, AccountParseError);
  const currencyCode = readCurrencyCode(record, 'currencyCode');
  const isActive = readBoolean(record, 'isActive', AccountParseError);
  const externalRefs = readOptionalExternalRefs(record);

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

function readCurrencyCode(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new AccountParseError(`${key} must be a 3-letter uppercase currency code.`);
  }
  return v;
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
