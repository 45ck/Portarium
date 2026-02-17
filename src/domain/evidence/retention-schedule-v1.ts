export type RetentionClass = 'Operational' | 'Compliance' | 'Forensic';

export type RetentionScheduleV1 = Readonly<{
  retentionClass: RetentionClass;
  retainUntilIso?: string;
  legalHold?: boolean;
}>;

export class RetentionScheduleParseError extends Error {
  public override readonly name = 'RetentionScheduleParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseRetentionScheduleV1(value: unknown): RetentionScheduleV1 {
  if (!isRecord(value)) {
    throw new RetentionScheduleParseError('RetentionSchedule must be an object.');
  }

  const retentionClassRaw = readString(value, 'retentionClass');
  if (!isRetentionClass(retentionClassRaw)) {
    throw new RetentionScheduleParseError(
      'retentionClass must be one of: Operational, Compliance, Forensic.',
    );
  }

  const retainUntilIso = readOptionalString(value, 'retainUntilIso');
  const legalHold = readOptionalBoolean(value, 'legalHold');

  return {
    retentionClass: retentionClassRaw,
    ...(retainUntilIso !== undefined ? { retainUntilIso } : {}),
    ...(legalHold !== undefined ? { legalHold } : {}),
  };
}

function isRetentionClass(value: string): value is RetentionClass {
  return value === 'Operational' || value === 'Compliance' || value === 'Forensic';
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new RetentionScheduleParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new RetentionScheduleParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readOptionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') {
    throw new RetentionScheduleParseError(`${key} must be a boolean when provided.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
