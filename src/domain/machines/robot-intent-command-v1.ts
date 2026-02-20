import {
  ExecutionEvidenceId,
  IntentId,
  type ExecutionEvidenceId as ExecutionEvidenceIdType,
  type ExecutionTier,
  type IntentId as IntentIdType,
} from '../primitives/index.js';
import {
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readRecordField,
  readString,
  readFiniteNumber,
  readOptionalFiniteNumber,
  parseEnumValue,
} from '../validation/parse-utils.js';

// ---------------------------------------------------------------------------
// Intent command types
// ---------------------------------------------------------------------------

export const INTENT_COMMAND_TYPES = [
  'navigate',
  'pick',
  'place',
  'inspect',
  'dock',
] as const;

export type IntentCommandType = (typeof INTENT_COMMAND_TYPES)[number];

export type WaypointTargetParams = Readonly<{
  kind: 'waypoint';
  waypointId: string;
}>;

export type CoordinatesTargetParams = Readonly<{
  kind: 'coordinates';
  x: number;
  y: number;
  z?: number;
}>;

export type TargetParams = WaypointTargetParams | CoordinatesTargetParams;

export type SafetyConstraints = Readonly<{
  maxVelocityMps?: number;
  geofenceBoundary?: string;
  collisionAvoidance: boolean;
}>;

export type IntentCommandV1 = Readonly<{
  schemaVersion: 1;
  intentId: IntentIdType;
  commandType: IntentCommandType;
  targetParams: TargetParams;
  safetyConstraints: SafetyConstraints;
  requiredApprovalTier: ExecutionTier;
  issuedAtIso: string;
  issuedBy: string;
  description?: string;
}>;

// ---------------------------------------------------------------------------
// Execution evidence types
// ---------------------------------------------------------------------------

export const EXECUTION_STATUSES = [
  'dispatched',
  'executing',
  'completed',
  'failed',
  'aborted',
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export type TelemetrySnapshot = Readonly<{
  batteryPercent?: number;
  positionX?: number;
  positionY?: number;
  velocityMps?: number;
}>;

export type ExecutionEvidenceV1 = Readonly<{
  schemaVersion: 1;
  evidenceId: ExecutionEvidenceIdType;
  intentId: IntentIdType;
  executionStatus: ExecutionStatus;
  telemetrySnapshot?: TelemetrySnapshot;
  completedAtIso?: string;
  recordedAtIso: string;
}>;

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

export class IntentCommandParseError extends Error {
  public override readonly name = 'IntentCommandParseError';

  public constructor(message: string) {
    super(message);
  }
}

export class ExecutionEvidenceParseError extends Error {
  public override readonly name = 'ExecutionEvidenceParseError';

  public constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Parse functions
// ---------------------------------------------------------------------------

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

function parseTargetParams(raw: unknown): TargetParams {
  const record = readRecord(raw, 'targetParams', IntentCommandParseError);
  const kind = readString(record, 'kind', IntentCommandParseError);

  if (kind === 'waypoint') {
    const waypointId = readString(record, 'waypointId', IntentCommandParseError);
    return { kind: 'waypoint', waypointId };
  }

  if (kind === 'coordinates') {
    const x = readFiniteNumber(record, 'x', IntentCommandParseError);
    const y = readFiniteNumber(record, 'y', IntentCommandParseError);
    const z = readOptionalFiniteNumber(record, 'z', IntentCommandParseError);
    return {
      kind: 'coordinates',
      x,
      y,
      ...(z !== undefined ? { z } : {}),
    };
  }

  throw new IntentCommandParseError(
    `targetParams.kind must be one of: waypoint, coordinates. Got: "${kind}"`,
  );
}

function parseSafetyConstraints(raw: unknown): SafetyConstraints {
  const record = readRecord(raw, 'safetyConstraints', IntentCommandParseError);

  const maxVelocityMps = readOptionalFiniteNumber(
    record,
    'maxVelocityMps',
    IntentCommandParseError,
  );
  if (maxVelocityMps !== undefined && maxVelocityMps <= 0) {
    throw new IntentCommandParseError('safetyConstraints.maxVelocityMps must be positive.');
  }

  const geofenceBoundary = readOptionalString(
    record,
    'geofenceBoundary',
    IntentCommandParseError,
  );

  const collisionAvoidanceRaw = record['collisionAvoidance'];
  if (typeof collisionAvoidanceRaw !== 'boolean') {
    throw new IntentCommandParseError(
      'safetyConstraints.collisionAvoidance must be a boolean.',
    );
  }

  return {
    collisionAvoidance: collisionAvoidanceRaw,
    ...(maxVelocityMps !== undefined ? { maxVelocityMps } : {}),
    ...(geofenceBoundary !== undefined ? { geofenceBoundary } : {}),
  };
}

export function parseIntentCommandV1(value: unknown): IntentCommandV1 {
  const record = readRecord(value, 'IntentCommand', IntentCommandParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', IntentCommandParseError);
  if (schemaVersion !== 1) {
    throw new IntentCommandParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const intentId = IntentId(readString(record, 'intentId', IntentCommandParseError));
  const commandType = parseEnumValue(
    record['commandType'],
    'commandType',
    INTENT_COMMAND_TYPES,
    IntentCommandParseError,
  );

  const targetParams = parseTargetParams(record['targetParams']);
  const safetyConstraints = parseSafetyConstraints(
    readRecordField(record, 'safetyConstraints', IntentCommandParseError),
  );

  const requiredApprovalTier = parseEnumValue(
    record['requiredApprovalTier'],
    'requiredApprovalTier',
    EXECUTION_TIERS,
    IntentCommandParseError,
  );

  const issuedAtIso = readIsoString(record, 'issuedAtIso', IntentCommandParseError);
  const issuedBy = readString(record, 'issuedBy', IntentCommandParseError);
  const description = readOptionalString(record, 'description', IntentCommandParseError);

  return {
    schemaVersion: 1,
    intentId,
    commandType,
    targetParams,
    safetyConstraints,
    requiredApprovalTier,
    issuedAtIso,
    issuedBy,
    ...(description !== undefined ? { description } : {}),
  };
}

function parseTelemetrySnapshot(raw: unknown): TelemetrySnapshot {
  const record = readRecord(raw, 'telemetrySnapshot', ExecutionEvidenceParseError);

  const batteryPercent = readOptionalFiniteNumber(
    record,
    'batteryPercent',
    ExecutionEvidenceParseError,
  );
  if (batteryPercent !== undefined && (batteryPercent < 0 || batteryPercent > 100)) {
    throw new ExecutionEvidenceParseError(
      'telemetrySnapshot.batteryPercent must be between 0 and 100.',
    );
  }

  const positionX = readOptionalFiniteNumber(record, 'positionX', ExecutionEvidenceParseError);
  const positionY = readOptionalFiniteNumber(record, 'positionY', ExecutionEvidenceParseError);
  const velocityMps = readOptionalFiniteNumber(
    record,
    'velocityMps',
    ExecutionEvidenceParseError,
  );

  return {
    ...(batteryPercent !== undefined ? { batteryPercent } : {}),
    ...(positionX !== undefined ? { positionX } : {}),
    ...(positionY !== undefined ? { positionY } : {}),
    ...(velocityMps !== undefined ? { velocityMps } : {}),
  };
}

export function parseExecutionEvidenceV1(value: unknown): ExecutionEvidenceV1 {
  const record = readRecord(value, 'ExecutionEvidence', ExecutionEvidenceParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ExecutionEvidenceParseError);
  if (schemaVersion !== 1) {
    throw new ExecutionEvidenceParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const evidenceId = ExecutionEvidenceId(
    readString(record, 'evidenceId', ExecutionEvidenceParseError),
  );
  const intentId = IntentId(readString(record, 'intentId', ExecutionEvidenceParseError));
  const executionStatus = parseEnumValue(
    record['executionStatus'],
    'executionStatus',
    EXECUTION_STATUSES,
    ExecutionEvidenceParseError,
  );

  const telemetrySnapshotRaw = record['telemetrySnapshot'];
  const telemetrySnapshot =
    telemetrySnapshotRaw === undefined
      ? undefined
      : parseTelemetrySnapshot(telemetrySnapshotRaw);

  const completedAtIso = readOptionalIsoString(
    record,
    'completedAtIso',
    ExecutionEvidenceParseError,
  );
  const recordedAtIso = readIsoString(record, 'recordedAtIso', ExecutionEvidenceParseError);

  return {
    schemaVersion: 1,
    evidenceId,
    intentId,
    executionStatus,
    recordedAtIso,
    ...(telemetrySnapshot !== undefined ? { telemetrySnapshot } : {}),
    ...(completedAtIso !== undefined ? { completedAtIso } : {}),
  };
}
