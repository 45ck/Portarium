import {
  readEnum,
  readOptionalBoolean,
  readOptionalIsoString,
  readRecord,
} from '../validation/parse-utils.js';

export type RetentionClass = 'Operational' | 'Compliance' | 'Forensic';

const RETENTION_CLASSES = ['Operational', 'Compliance', 'Forensic'] as const;

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
  const record = readRecord(value, 'RetentionSchedule', RetentionScheduleParseError);

  const retentionClassRaw = readEnum(
    record,
    'retentionClass',
    RETENTION_CLASSES,
    RetentionScheduleParseError,
  );
  const retainUntilIso = readOptionalIsoString(
    record,
    'retainUntilIso',
    RetentionScheduleParseError,
  );
  const legalHold = readOptionalBoolean(record, 'legalHold', RetentionScheduleParseError);

  return {
    retentionClass: retentionClassRaw,
    ...(retainUntilIso !== undefined ? { retainUntilIso } : {}),
    ...(legalHold !== undefined ? { legalHold } : {}),
  };
}
