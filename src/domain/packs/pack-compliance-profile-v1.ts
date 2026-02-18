import {
  ComplianceProfileId,
  PackId,
  type ComplianceProfileId as ComplianceProfileIdType,
  type PackId as PackIdType,
} from '../primitives/index.js';
import { readInteger, readRecord, readString } from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Pack compliance profile', PackComplianceProfileParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PackComplianceProfileParseError);
  if (schemaVersion !== 1) {
    throw new PackComplianceProfileParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const profileId = readString(record, 'profileId', PackComplianceProfileParseError);
  const packId = readString(record, 'packId', PackComplianceProfileParseError);
  const namespace = readString(record, 'namespace', PackComplianceProfileParseError);
  const jurisdiction = readString(record, 'jurisdiction', PackComplianceProfileParseError);

  const constraintsRaw = record['constraints'];
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
  const record = readRecord(value, `constraints[${index}]`, PackComplianceProfileParseError);

  const constraintId = readString(record, 'constraintId', PackComplianceProfileParseError);
  const rule = readString(record, 'rule', PackComplianceProfileParseError);
  const severity = readString(record, 'severity', PackComplianceProfileParseError);

  return { constraintId, rule, severity };
}
