import {
  FleetId,
  GatewayId,
  MissionId,
  RobotId,
  UserId,
  type FleetId as FleetIdType,
  type GatewayId as GatewayIdType,
  type MissionId as MissionIdType,
  type RobotId as RobotIdType,
  type UserId as UserIdType,
} from '../primitives/index.js';
import {
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const MISSION_ACTION_KINDS = [
  'robot:execute_action',
  'robot:cancel_action',
  'robot:stop',
  'robot:estop_request',
] as const;
const STOP_PATH_ACTIONS = ['robot:stop', 'robot:estop_request'] as const;
const PHYSICAL_ACTIONS = ['robot:execute_action', 'robot:cancel_action'] as const;
const COMPLETION_MODES = ['Auto', 'ManualOnly'] as const;
const MANUAL_COMPLETION_OUTCOMES = ['Succeeded', 'Failed'] as const;

export type MissionActionKind = (typeof MISSION_ACTION_KINDS)[number];
export type StopPathActionKind = (typeof STOP_PATH_ACTIONS)[number];
export type MissionCompletionMode = (typeof COMPLETION_MODES)[number];
export type ManualCompletionOutcome = (typeof MANUAL_COMPLETION_OUTCOMES)[number];

export type MissionActionRequestV1 = Readonly<{
  schemaVersion: 1;
  missionId: MissionIdType;
  robotId: RobotIdType;
  fleetId?: FleetIdType;
  gatewayId: GatewayIdType;
  actionType: MissionActionKind;
  actionName: string;
  parameters: Readonly<Record<string, unknown>>;
  idempotencyKey?: string;
  supportsPreemption: boolean;
  bypassTierEvaluation: boolean;
  completionMode: MissionCompletionMode;
  requiresOperatorConfirmation: boolean;
  requestedAt: string;
}>;

export type MissionManualCompletionSignalV1 = Readonly<{
  schemaVersion: 1;
  missionId: MissionIdType;
  actionExecutionId: string;
  operatorUserId: UserIdType;
  outcome: ManualCompletionOutcome;
  confirmedAt: string;
  note?: string;
}>;

export class MissionActionSemanticsParseError extends Error {
  public override readonly name = 'MissionActionSemanticsParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseMissionActionRequestV1(value: unknown): MissionActionRequestV1 {
  const record = readRecord(value, 'MissionActionRequest', MissionActionSemanticsParseError);
  assertSchemaVersion(record, 'MissionActionRequest');

  const actionType = parseActionType(
    readString(record, 'actionType', MissionActionSemanticsParseError),
  );
  const completionMode = parseCompletionMode(
    readString(record, 'completionMode', MissionActionSemanticsParseError),
  );
  const supportsPreemption = readBoolean(record, 'supportsPreemption');
  const bypassTierEvaluation = readBoolean(record, 'bypassTierEvaluation');
  const requiresOperatorConfirmation = readBoolean(record, 'requiresOperatorConfirmation');
  const idempotencyKey = readOptionalString(
    record,
    'idempotencyKey',
    MissionActionSemanticsParseError,
  );
  const parameters = readRecord(
    record['parameters'],
    'parameters',
    MissionActionSemanticsParseError,
  );
  const fleetIdRaw = readOptionalString(record, 'fleetId', MissionActionSemanticsParseError);

  validateMissionActionSemantics({
    actionType,
    completionMode,
    idempotencyKey,
    supportsPreemption,
    bypassTierEvaluation,
    requiresOperatorConfirmation,
  });

  return {
    schemaVersion: 1,
    missionId: MissionId(readString(record, 'missionId', MissionActionSemanticsParseError)),
    robotId: RobotId(readString(record, 'robotId', MissionActionSemanticsParseError)),
    gatewayId: GatewayId(readString(record, 'gatewayId', MissionActionSemanticsParseError)),
    ...(fleetIdRaw ? { fleetId: FleetId(fleetIdRaw) } : {}),
    actionType,
    actionName: readString(record, 'actionName', MissionActionSemanticsParseError),
    parameters,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    supportsPreemption,
    bypassTierEvaluation,
    completionMode,
    requiresOperatorConfirmation,
    requestedAt: readIsoString(record, 'requestedAt', MissionActionSemanticsParseError),
  };
}

export function parseMissionManualCompletionSignalV1(
  value: unknown,
): MissionManualCompletionSignalV1 {
  const record = readRecord(
    value,
    'MissionManualCompletionSignal',
    MissionActionSemanticsParseError,
  );
  assertSchemaVersion(record, 'MissionManualCompletionSignal');
  const note = readOptionalString(record, 'note', MissionActionSemanticsParseError);

  const outcomeRaw = readString(record, 'outcome', MissionActionSemanticsParseError);
  if (!(MANUAL_COMPLETION_OUTCOMES as readonly string[]).includes(outcomeRaw)) {
    throw new MissionActionSemanticsParseError(
      `outcome must be one of: ${MANUAL_COMPLETION_OUTCOMES.join(', ')}.`,
    );
  }

  return {
    schemaVersion: 1,
    missionId: MissionId(readString(record, 'missionId', MissionActionSemanticsParseError)),
    actionExecutionId: readString(record, 'actionExecutionId', MissionActionSemanticsParseError),
    operatorUserId: UserId(readString(record, 'operatorUserId', MissionActionSemanticsParseError)),
    outcome: outcomeRaw as ManualCompletionOutcome,
    confirmedAt: readIsoString(record, 'confirmedAt', MissionActionSemanticsParseError),
    ...(note ? { note } : {}),
  };
}

export function isStopPathAction(value: string): value is StopPathActionKind {
  return (STOP_PATH_ACTIONS as readonly string[]).includes(value);
}

function assertSchemaVersion(record: Record<string, unknown>, label: string): void {
  if (record['schemaVersion'] !== 1) {
    throw new MissionActionSemanticsParseError(`${label}.schemaVersion must be 1.`);
  }
}

function parseActionType(value: string): MissionActionKind {
  if ((MISSION_ACTION_KINDS as readonly string[]).includes(value)) {
    return value as MissionActionKind;
  }
  throw new MissionActionSemanticsParseError(
    `actionType must be one of: ${MISSION_ACTION_KINDS.join(', ')}.`,
  );
}

function parseCompletionMode(value: string): MissionCompletionMode {
  if ((COMPLETION_MODES as readonly string[]).includes(value)) {
    return value as MissionCompletionMode;
  }
  throw new MissionActionSemanticsParseError(
    `completionMode must be one of: ${COMPLETION_MODES.join(', ')}.`,
  );
}

function isPhysicalAction(value: MissionActionKind): boolean {
  return (PHYSICAL_ACTIONS as readonly string[]).includes(value);
}

function validateMissionActionSemantics(input: {
  actionType: MissionActionKind;
  completionMode: MissionCompletionMode;
  idempotencyKey: string | undefined;
  supportsPreemption: boolean;
  bypassTierEvaluation: boolean;
  requiresOperatorConfirmation: boolean;
}): void {
  if (isPhysicalAction(input.actionType) && !input.idempotencyKey) {
    throw new MissionActionSemanticsParseError(
      `idempotencyKey is required for ${input.actionType} requests.`,
    );
  }

  if (isStopPathAction(input.actionType) && !input.bypassTierEvaluation) {
    throw new MissionActionSemanticsParseError(
      `${input.actionType} must set bypassTierEvaluation=true.`,
    );
  }

  if (input.actionType === 'robot:execute_action' && !input.supportsPreemption) {
    throw new MissionActionSemanticsParseError(
      'robot:execute_action must set supportsPreemption=true.',
    );
  }

  if (input.completionMode === 'ManualOnly' && !input.requiresOperatorConfirmation) {
    throw new MissionActionSemanticsParseError(
      'ManualOnly completion requires requiresOperatorConfirmation=true.',
    );
  }
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const raw = record[key];
  if (typeof raw !== 'boolean') {
    throw new MissionActionSemanticsParseError(`${key} must be a boolean.`);
  }
  return raw;
}
