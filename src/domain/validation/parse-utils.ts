export type ErrorFactory = new (message: string) => Error;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRecord(
  value: unknown,
  kind: string,
  createError: ErrorFactory,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new createError(`${kind} must be an object.`);
  }
  return value;
}

export function readString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new createError(`${key} must be a non-empty string.`);
  }
  return value;
}

export function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  requiredMessage?: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new createError(requiredMessage ?? `${key} must be a non-empty string when provided.`);
  }
  return value;
}

export function readBoolean(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new createError(`${key} must be a boolean.`);
  }
  return value;
}

export function readInteger(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new createError(`${key} must be an integer.`);
  }
  return value;
}

export function parseIsoDate(value: string, label: string, createError: ErrorFactory): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new createError(`${label} must be a valid ISO timestamp.`);
  }
  return parsed;
}

export function readIsoString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): string {
  const value = readString(record, key, createError);
  parseIsoDate(value, key, createError);
  return value;
}

export function readOptionalIsoString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): string | undefined {
  const value = readOptionalString(record, key, createError);
  if (value !== undefined) {
    parseIsoDate(value, key, createError);
  }
  return value;
}

export function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  createError: ErrorFactory,
): T {
  const value = readString(record, key, createError);
  if (!allowed.includes(value as T)) {
    throw new createError(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
