import {
  ComplianceProfileId,
  PackId,
  type ComplianceProfileId as ComplianceProfileIdType,
  type PackId as PackIdType,
} from '../primitives/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComplianceConstraintV1 = Readonly<{
  constraintId: string;
  rule: string;
  severity: string;
}>;

export type PackComplianceProfileV1 = Readonly<{
  schemaVersion: 1;
  profileId: ComplianceProfileIdType;
  packId: PackIdType;
  namespace: string;
  jurisdiction: string;
  constraints: readonly ComplianceConstraintV1[];
}>;

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PackComplianceProfileParseError extends Error {
  public override readonly name = 'PackComplianceProfileParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parsePackComplianceProfileV1(value: unknown): PackComplianceProfileV1 {
  if (!isRecord(value)) {
    throw new PackComplianceProfileParseError('Pack compliance profile must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PackComplianceProfileParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const profileId = readString(value, 'profileId');
  const packId = readString(value, 'packId');
  const namespace = readString(value, 'namespace');
  const jurisdiction = readString(value, 'jurisdiction');

  const constraintsRaw = value['constraints'];
  if (!Array.isArray(constraintsRaw)) {
    throw new PackComplianceProfileParseError('constraints must be an array.');
  }
  const constraints = constraintsRaw.map((c, i) => parseConstraint(c, i));

  return {
    schemaVersion: 1,
    profileId: ComplianceProfileId(profileId),
    packId: PackId(packId),
    namespace,
    jurisdiction,
    constraints,
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parseConstraint(value: unknown, index: number): ComplianceConstraintV1 {
  if (!isRecord(value)) {
    throw new PackComplianceProfileParseError(`constraints[${index}] must be an object.`);
  }

  const constraintId = readString(value, 'constraintId');
  const rule = readString(value, 'rule');
  const severity = readString(value, 'severity');

  return { constraintId, rule, severity };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PackComplianceProfileParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new PackComplianceProfileParseError(`${key} must be an integer.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
