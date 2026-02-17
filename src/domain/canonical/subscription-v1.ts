import {
  SubscriptionId,
  TenantId,
  type SubscriptionId as SubscriptionIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import { type ExternalObjectRef, parseExternalObjectRef } from './external-object-ref.js';

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
  if (!isRecord(value)) {
    throw new SubscriptionParseError('Subscription must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new SubscriptionParseError('schemaVersion must be 1.');
  }

  const subscriptionId = SubscriptionId(readString(value, 'subscriptionId'));
  const tenantId = TenantId(readString(value, 'tenantId'));
  const planName = readString(value, 'planName');
  const status = readEnum(value, 'status', SUBSCRIPTION_STATUSES);
  const currencyCode = readOptionalCurrencyCode(value, 'currencyCode');
  const recurringAmount = readOptionalNonNegativeNumber(value, 'recurringAmount');
  const currentPeriodStartIso = readOptionalString(value, 'currentPeriodStartIso');
  const currentPeriodEndIso = readOptionalString(value, 'currentPeriodEndIso');
  const externalRefs = readOptionalExternalRefs(value);

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new SubscriptionParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new SubscriptionParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
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

function readOptionalNonNegativeNumber(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new SubscriptionParseError(`${key} must be a non-negative number when provided.`);
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
    throw new SubscriptionParseError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return v as T;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
