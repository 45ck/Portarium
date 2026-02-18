export type ErrorFactory = new (message: string) => Error;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRecord(
  value: unknown,
  label: string,
  createError: ErrorFactory,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new createError(`${label} must be an object.`);
  }
  return value;
}

export function parseNonEmptyString(
  value: unknown,
  label: string,
  createError: ErrorFactory,
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new createError(`${label} must be a non-empty string.`);
  }
  return value;
}

export function parseBoolean(value: unknown, label: string, createError: ErrorFactory): boolean {
  if (typeof value !== 'boolean') {
    throw new createError(`${label} must be a boolean.`);
  }
  return value;
}

export function parseInteger(value: unknown, label: string, createError: ErrorFactory): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new createError(`${label} must be an integer.`);
  }
  return value;
}

export function parseFiniteNumber(
  value: unknown,
  label: string,
  createError: ErrorFactory,
): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new createError(`${label} must be a finite number.`);
  }
  return value;
}

export function parseEnumValue<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
  createError: ErrorFactory,
): T {
  const str = parseNonEmptyString(value, label, createError);
  if (!allowed.includes(str as T)) {
    throw new createError(`${label} must be one of: ${allowed.join(', ')}.`);
  }
  return str as T;
}

export function readRecord(
  value: unknown,
  kind: string,
  createError: ErrorFactory,
): Record<string, unknown> {
  return parseRecord(value, kind, createError);
}

export function readString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  opts?: Readonly<{ path?: string }>,
): string {
  const label = opts?.path != null ? `${opts.path}.${key}` : key;
  return parseNonEmptyString(record[key], label, createError);
}

export function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  opts?: Readonly<{ path?: string; requiredMessage?: string }>,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  const label = opts?.path != null ? `${opts.path}.${key}` : key;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new createError(
      opts?.requiredMessage ?? `${label} must be a non-empty string when provided.`,
    );
  }
  return value;
}

export function readBoolean(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  opts?: Readonly<{ path?: string }>,
): boolean {
  const label = opts?.path != null ? `${opts.path}.${key}` : key;
  return parseBoolean(record[key], label, createError);
}

export function readOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new createError(`${key} must be a boolean when provided.`);
  }
  return value;
}

export function readInteger(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number {
  return parseInteger(record[key], key, createError);
}

export function readOptionalInteger(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new createError(`${key} must be an integer when provided.`);
  }
  return value;
}

export function readFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number {
  return parseFiniteNumber(record[key], key, createError);
}

export function readOptionalFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new createError(`${key} must be a finite number when provided.`);
  }
  return value;
}

export function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number {
  const value = readInteger(record, key, createError);
  if (value < 0) {
    throw new createError(`${key} must be a non-negative integer.`);
  }
  return value;
}

export function readOptionalNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number | undefined {
  const value = readOptionalInteger(record, key, createError);
  if (value === undefined) return undefined;
  if (value < 0) {
    throw new createError(`${key} must be a non-negative integer when provided.`);
  }
  return value;
}

export function readNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number {
  const value = readFiniteNumber(record, key, createError);
  if (value < 0) {
    throw new createError(`${key} must be a non-negative number.`);
  }
  return value;
}

export function readOptionalNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): number | undefined {
  const value = readOptionalFiniteNumber(record, key, createError);
  if (value === undefined) return undefined;
  if (value < 0) {
    throw new createError(`${key} must be a non-negative number when provided.`);
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

/**
 * Assert that `laterIso` is not before `anchorIso`.
 * If `laterIso` < `anchorIso`, throws using `createError`.
 * Both values must already be validated ISO strings.
 */
export function assertNotBefore(
  anchorIso: string,
  laterIso: string,
  createError: ErrorFactory,
  opts: Readonly<{ anchorLabel: string; laterLabel: string }>,
): void {
  const anchor = parseIsoDate(anchorIso, opts.anchorLabel, createError);
  const later = parseIsoDate(laterIso, opts.laterLabel, createError);
  if (later < anchor) {
    throw new createError(`${opts.laterLabel} must not precede ${opts.anchorLabel}.`);
  }
}

export function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  createError: ErrorFactory,
): T {
  return parseEnumValue(record[key], key, allowed, createError);
}

export function readOptionalEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  createError: ErrorFactory,
): T | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  const str = parseNonEmptyString(value, `${key} when provided`, createError);
  if (!allowed.includes(str as T)) {
    throw new createError(`${key} must be one of: ${allowed.join(', ')} when provided.`);
  }
  return str as T;
}

export function readStringArray(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  opts?: Readonly<{ minLength?: number }>,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new createError(`${key} must be an array.`);
  }

  const minLength = opts?.minLength ?? 0;
  if (minLength === 1 && value.length === 0) {
    throw new createError(`${key} must be a non-empty array.`);
  }
  if (minLength > 1 && value.length < minLength) {
    throw new createError(`${key} must have length >= ${minLength}.`);
  }

  return value.map((item, idx) => parseNonEmptyString(item, `${key}[${idx}]`, createError));
}

export function readOptionalStringArray(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
  opts?: Readonly<{ minLength?: number }>,
): readonly string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  return readStringArray(record, key, createError, opts);
}

export function readRecordField(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): Record<string, unknown> {
  return parseRecord(record[key], key, createError);
}

export function readOptionalRecordField(
  record: Record<string, unknown>,
  key: string,
  createError: ErrorFactory,
): Record<string, unknown> | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!isObject(value)) {
    throw new createError(`${key} must be an object when provided.`);
  }
  return value;
}
