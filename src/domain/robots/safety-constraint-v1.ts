import {
  RobotId,
  UserId,
  type RobotId as RobotIdType,
  type UserId as UserIdType,
} from '../primitives/index.js';
import { readIsoString, readRecord, readString } from '../validation/parse-utils.js';

const SAFETY_CONSTRAINT_TYPES = [
  'Geofence',
  'SpeedLimit',
  'PayloadLimit',
  'ProximityZone',
  'OperatorRequired',
] as const;
const SAFETY_ENFORCED_BY = ['edge', 'policy'] as const;
const SAFETY_SEVERITIES = ['Advisory', 'Enforced', 'HardStop'] as const;

export type SafetyConstraintType = (typeof SAFETY_CONSTRAINT_TYPES)[number];
export type SafetyConstraintEnforcedBy = (typeof SAFETY_ENFORCED_BY)[number];
export type SafetyConstraintSeverity = (typeof SAFETY_SEVERITIES)[number];

export type SafetyConstraintV1 = Readonly<{
  constraintType: SafetyConstraintType;
  value: string;
  enforcedBy: SafetyConstraintEnforcedBy;
  severity: SafetyConstraintSeverity;
}>;

export type SafetyCaseV1 = Readonly<{
  schemaVersion: 1;
  robotId: RobotIdType;
  appliedConstraints: readonly SafetyConstraintV1[];
  riskAssessmentRef: string;
  lastReviewedAt: string;
  approvedBy: UserIdType;
}>;

export class SafetyConstraintParseError extends Error {
  public override readonly name = 'SafetyConstraintParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseSafetyConstraintV1(value: unknown): SafetyConstraintV1 {
  const record = readRecord(value, 'SafetyConstraint', SafetyConstraintParseError);
  const constraintType = parseSafetyConstraintType(
    readString(record, 'constraintType', SafetyConstraintParseError),
  );
  const enforcedBy = parseEnforcedBy(readString(record, 'enforcedBy', SafetyConstraintParseError));
  const severity = parseSeverity(readString(record, 'severity', SafetyConstraintParseError));

  return {
    constraintType,
    value: readString(record, 'value', SafetyConstraintParseError),
    enforcedBy,
    severity,
  };
}

export function parseSafetyCaseV1(value: unknown): SafetyCaseV1 {
  const record = readRecord(value, 'SafetyCase', SafetyConstraintParseError);
  if (record['schemaVersion'] !== 1) {
    throw new SafetyConstraintParseError('SafetyCase.schemaVersion must be 1.');
  }

  return {
    schemaVersion: 1,
    robotId: RobotId(readString(record, 'robotId', SafetyConstraintParseError)),
    appliedConstraints: parseConstraintArray(record['appliedConstraints']),
    riskAssessmentRef: readString(record, 'riskAssessmentRef', SafetyConstraintParseError),
    lastReviewedAt: readIsoString(record, 'lastReviewedAt', SafetyConstraintParseError),
    approvedBy: UserId(readString(record, 'approvedBy', SafetyConstraintParseError)),
  };
}

export function hasConstraintType(
  safetyCase: SafetyCaseV1,
  constraintType: SafetyConstraintType,
): boolean {
  return safetyCase.appliedConstraints.some((c) => c.constraintType === constraintType);
}

function parseConstraintArray(value: unknown): readonly SafetyConstraintV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new SafetyConstraintParseError('appliedConstraints must be a non-empty array.');
  }
  return value.map((entry, i) =>
    parseSafetyConstraintV1WithPath(entry, `appliedConstraints[${i}]`),
  );
}

function parseSafetyConstraintV1WithPath(value: unknown, pathLabel: string): SafetyConstraintV1 {
  const record = readRecord(value, pathLabel, SafetyConstraintParseError);
  const constraintType = parseSafetyConstraintType(
    readString(record, 'constraintType', SafetyConstraintParseError),
  );
  const enforcedBy = parseEnforcedBy(readString(record, 'enforcedBy', SafetyConstraintParseError));
  const severity = parseSeverity(readString(record, 'severity', SafetyConstraintParseError));

  return {
    constraintType,
    value: readString(record, 'value', SafetyConstraintParseError),
    enforcedBy,
    severity,
  };
}

function parseSafetyConstraintType(value: string): SafetyConstraintType {
  if ((SAFETY_CONSTRAINT_TYPES as readonly string[]).includes(value)) {
    return value as SafetyConstraintType;
  }
  throw new SafetyConstraintParseError(
    `constraintType must be one of: ${SAFETY_CONSTRAINT_TYPES.join(', ')}.`,
  );
}

function parseEnforcedBy(value: string): SafetyConstraintEnforcedBy {
  if ((SAFETY_ENFORCED_BY as readonly string[]).includes(value)) {
    return value as SafetyConstraintEnforcedBy;
  }
  throw new SafetyConstraintParseError(
    `enforcedBy must be one of: ${SAFETY_ENFORCED_BY.join(', ')}.`,
  );
}

function parseSeverity(value: string): SafetyConstraintSeverity {
  if ((SAFETY_SEVERITIES as readonly string[]).includes(value)) {
    return value as SafetyConstraintSeverity;
  }
  throw new SafetyConstraintParseError(`severity must be one of: ${SAFETY_SEVERITIES.join(', ')}.`);
}
