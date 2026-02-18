import {
  readInteger,
  readOptionalInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type RateLimitV1 = Readonly<{
  requestsPerMinute: number;
}>;

export type DailyCapV1 = Readonly<{
  requestsPerDay: number;
  resetAtUtcHour?: number;
}>;

export type BatchingV1 = Readonly<{
  maxBatchSize: number;
}>;

export type RetryAfterSemanticsV1 =
  | Readonly<{ kind: 'None' }>
  | Readonly<{ kind: 'RetryAfterSeconds'; headerName: string }>
  | Readonly<{ kind: 'RetryAfterHttpDate'; headerName: string }>
  | Readonly<{ kind: 'ResetEpochSeconds'; headerName: string }>;

export type QuotaSemanticsV1 = Readonly<{
  schemaVersion: 1;
  rateLimit?: RateLimitV1;
  dailyCap?: DailyCapV1;
  batching?: BatchingV1;
  retryAfter?: RetryAfterSemanticsV1;
  notes?: string;
}>;

export class QuotaSemanticsParseError extends Error {
  public override readonly name = 'QuotaSemanticsParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseQuotaSemanticsV1(value: unknown): QuotaSemanticsV1 {
  const record = readRecord(value, 'QuotaSemantics', QuotaSemanticsParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', QuotaSemanticsParseError);
  if (schemaVersion !== 1) {
    throw new QuotaSemanticsParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const out: {
    schemaVersion: 1;
    rateLimit?: RateLimitV1;
    dailyCap?: DailyCapV1;
    batching?: BatchingV1;
    retryAfter?: RetryAfterSemanticsV1;
    notes?: string;
  } = { schemaVersion: 1 };

  const rateLimitRaw = record['rateLimit'];
  if (rateLimitRaw !== undefined) out.rateLimit = parseRateLimitV1(rateLimitRaw);

  const dailyCapRaw = record['dailyCap'];
  if (dailyCapRaw !== undefined) out.dailyCap = parseDailyCapV1(dailyCapRaw);

  const batchingRaw = record['batching'];
  if (batchingRaw !== undefined) out.batching = parseBatchingV1(batchingRaw);

  const retryAfterRaw = record['retryAfter'];
  if (retryAfterRaw !== undefined) out.retryAfter = parseRetryAfterV1(retryAfterRaw);

  const notes = readOptionalString(record, 'notes', QuotaSemanticsParseError);
  if (notes !== undefined) out.notes = notes;

  return out;
}

function parseRateLimitV1(value: unknown): RateLimitV1 {
  const record = readRecord(value, 'rateLimit', QuotaSemanticsParseError);
  const requestsPerMinute = readIntegerMin(record, 'requestsPerMinute', 1);
  return { requestsPerMinute };
}

function parseDailyCapV1(value: unknown): DailyCapV1 {
  const record = readRecord(value, 'dailyCap', QuotaSemanticsParseError);

  const requestsPerDay = readIntegerMin(record, 'requestsPerDay', 1);

  const resetAtUtcHourRaw = readOptionalInteger(record, 'resetAtUtcHour', QuotaSemanticsParseError);
  if (resetAtUtcHourRaw !== undefined) {
    if (resetAtUtcHourRaw < 0 || resetAtUtcHourRaw > 23) {
      throw new QuotaSemanticsParseError('dailyCap.resetAtUtcHour must be between 0 and 23.');
    }
  }

  return {
    requestsPerDay,
    ...(resetAtUtcHourRaw === undefined ? {} : { resetAtUtcHour: resetAtUtcHourRaw }),
  };
}

function parseBatchingV1(value: unknown): BatchingV1 {
  const record = readRecord(value, 'batching', QuotaSemanticsParseError);
  const maxBatchSize = readIntegerMin(record, 'maxBatchSize', 1);
  return { maxBatchSize };
}

function parseRetryAfterV1(value: unknown): RetryAfterSemanticsV1 {
  const record = readRecord(value, 'retryAfter', QuotaSemanticsParseError);

  const kindRaw = readString(record, 'kind', QuotaSemanticsParseError);

  if (kindRaw === 'None') return { kind: 'None' };

  if (
    kindRaw !== 'RetryAfterSeconds' &&
    kindRaw !== 'RetryAfterHttpDate' &&
    kindRaw !== 'ResetEpochSeconds'
  ) {
    throw new QuotaSemanticsParseError(
      'retryAfter.kind must be one of: None, RetryAfterSeconds, RetryAfterHttpDate, ResetEpochSeconds.',
    );
  }

  const headerName = readString(record, 'headerName', QuotaSemanticsParseError);
  return { kind: kindRaw, headerName };
}

function readIntegerMin(obj: Record<string, unknown>, key: string, min: number): number {
  const v = readInteger(obj, key, QuotaSemanticsParseError);
  if (v < min) throw new QuotaSemanticsParseError(`${key} must be >= ${min}.`);
  return v;
}
