import {
  SubscriptionId,
  TenantId,
  type SubscriptionId as SubscriptionIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';
import {
  readEnum,
  readInteger,
  readOptionalIsoString,
  readOptionalNonNegativeNumber,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'cancelled', 'expired'] as const;
type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionV1 = Readonly<{
  subscriptionId: SubscriptionIdType;
  tenantId: TenantIdType;
  schemaVersion: 1;
  planName: string;
  status: SubscriptionStatus;
  currencyCode?: string;
  recurringAmount?: number;
  currentPeriodStartIso?: string;
  currentPeriodEndIso?: string;
  externalRefs?: readonly ExternalObjectRef[];
}>;

export class SubscriptionParseError extends Error {
  public override readonly name = 'SubscriptionParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseSubscriptionV1(value: unknown): SubscriptionV1 {
  const record = readRecord(value, 'Subscription', SubscriptionParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', SubscriptionParseError);
  if (schemaVersion !== 1) {
    throw new SubscriptionParseError('schemaVersion must be 1.');
  }

  const subscriptionId = SubscriptionId(
    readString(record, 'subscriptionId', SubscriptionParseError),
  );
  const tenantId = TenantId(readString(record, 'tenantId', SubscriptionParseError));
  const planName = readString(record, 'planName', SubscriptionParseError);
  const status = readEnum(record, 'status', SUBSCRIPTION_STATUSES, SubscriptionParseError);
  const currencyCode = readOptionalCurrencyCode(record, 'currencyCode');
  const recurringAmount = readOptionalNonNegativeNumber(
    record,
    'recurringAmount',
    SubscriptionParseError,
  );
  const currentPeriodStartIso = readOptionalIsoString(
    record,
    'currentPeriodStartIso',
    SubscriptionParseError,
  );
  const currentPeriodEndIso = readOptionalIsoString(
    record,
    'currentPeriodEndIso',
    SubscriptionParseError,
  );
  const externalRefs = readOptionalExternalRefs(record);

  return {
    subscriptionId,
    tenantId,
    schemaVersion: 1,
    planName,
    status,
    ...(currencyCode ? { currencyCode } : {}),
    ...(recurringAmount !== undefined ? { recurringAmount } : {}),
    ...(currentPeriodStartIso ? { currentPeriodStartIso } : {}),
    ...(currentPeriodEndIso ? { currentPeriodEndIso } : {}),
    ...(externalRefs ? { externalRefs } : {}),
  };
}

function readOptionalCurrencyCode(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !/^[A-Z]{3}$/.test(v)) {
    throw new SubscriptionParseError(
      `${key} must be a 3-letter uppercase currency code when provided.`,
    );
  }
  return v;
}

function readOptionalExternalRefs(
  obj: Record<string, unknown>,
): readonly ExternalObjectRef[] | undefined {
  const v = obj['externalRefs'];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) {
    throw new SubscriptionParseError('externalRefs must be an array when provided.');
  }
  return v.map((item) => parseExternalObjectRef(item));
}
