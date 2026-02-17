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
  if (!isRecord(value)) throw new QuotaSemanticsParseError('QuotaSemantics must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
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

  const rateLimitRaw = value['rateLimit'];
  if (rateLimitRaw !== undefined) out.rateLimit = parseRateLimitV1(rateLimitRaw);

  const dailyCapRaw = value['dailyCap'];
  if (dailyCapRaw !== undefined) out.dailyCap = parseDailyCapV1(dailyCapRaw);

  const batchingRaw = value['batching'];
  if (batchingRaw !== undefined) out.batching = parseBatchingV1(batchingRaw);

  const retryAfterRaw = value['retryAfter'];
  if (retryAfterRaw !== undefined) out.retryAfter = parseRetryAfterV1(retryAfterRaw);

  const notes = readOptionalString(value, 'notes');
  if (notes !== undefined) out.notes = notes;

  return out;
}

function parseRateLimitV1(value: unknown): RateLimitV1 {
  if (!isRecord(value)) throw new QuotaSemanticsParseError('rateLimit must be an object.');
  const requestsPerMinute = readNumberMin(value, 'requestsPerMinute', 1);
  return { requestsPerMinute };
}

function parseDailyCapV1(value: unknown): DailyCapV1 {
  if (!isRecord(value)) throw new QuotaSemanticsParseError('dailyCap must be an object.');

  const requestsPerDay = readNumberMin(value, 'requestsPerDay', 1);

  const resetAtUtcHourRaw = readOptionalNumber(value, 'resetAtUtcHour');
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
  if (!isRecord(value)) throw new QuotaSemanticsParseError('batching must be an object.');
  const maxBatchSize = readNumberMin(value, 'maxBatchSize', 1);
  return { maxBatchSize };
}

function parseRetryAfterV1(value: unknown): RetryAfterSemanticsV1 {
  if (!isRecord(value)) throw new QuotaSemanticsParseError('retryAfter must be an object.');

  const kindRaw = readString(value, 'kind');

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

  const headerName = readString(value, 'headerName');
  return { kind: kindRaw, headerName };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new QuotaSemanticsParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new QuotaSemanticsParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new QuotaSemanticsParseError(`${key} must be an integer.`);
  }
  return v;
}

function readOptionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new QuotaSemanticsParseError(`${key} must be an integer when provided.`);
  }
  return v;
}

function readNumberMin(obj: Record<string, unknown>, key: string, min: number): number {
  const v = readNumber(obj, key);
  if (v < min) throw new QuotaSemanticsParseError(`${key} must be >= ${min}.`);
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
