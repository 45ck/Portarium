import {
  FleetId,
  GatewayId,
  MissionId,
  RobotId,
  type FleetId as FleetIdType,
  type GatewayId as GatewayIdType,
  type MissionId as MissionIdType,
  type RobotId as RobotIdType,
} from '../primitives/index.js';
import {
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const MISSION_PRIORITIES = ['Low', 'Normal', 'High', 'Critical'] as const;
const MISSION_STATUSES = [
  'Pending',
  'Dispatched',
  'Executing',
  'WaitingPreemption',
  'Succeeded',
  'Failed',
  'Cancelled',
] as const;
const FEEDBACK_LEVELS = ['Info', 'Warning', 'Error'] as const;

export type MissionPriority = (typeof MISSION_PRIORITIES)[number];
export type MissionStatus = (typeof MISSION_STATUSES)[number];
export type ActionFeedbackLevel = (typeof FEEDBACK_LEVELS)[number];

export type MissionV1 = Readonly<{
  schemaVersion: 1;
  missionId: MissionIdType;
  robotId: RobotIdType;
  fleetId?: FleetIdType;
  goalSpec: Readonly<Record<string, unknown>>;
  priority: MissionPriority;
  constraints: Readonly<Record<string, unknown>>;
  status: MissionStatus;
  idempotencyKey: string;
}>;

export type ActionExecutionFeedbackEntryV1 = Readonly<{
  at: string;
  level: ActionFeedbackLevel;
  message: string;
}>;

export type ActionExecutionV1 = Readonly<{
  schemaVersion: 1;
  executionId: string;
  missionId: MissionIdType;
  gatewayRef: GatewayIdType;
  feedbackLog: readonly ActionExecutionFeedbackEntryV1[];
  preemptedAt?: string;
}>;

/**
 * Compile-time lifecycle map for Mission status transitions.
 * This models ROS 2 Action-style pre-emption:
 * - Executing -> WaitingPreemption when cancel/preempt is requested.
 * - WaitingPreemption -> Executing if resumed/replanned.
 */
export interface MissionStatusTransitionMap {
  Pending: 'Dispatched' | 'Cancelled';
  Dispatched: 'Executing' | 'Cancelled' | 'Failed';
  Executing: 'WaitingPreemption' | 'Succeeded' | 'Failed' | 'Cancelled';
  WaitingPreemption: 'Executing' | 'Cancelled' | 'Failed';
  Succeeded: never;
  Failed: never;
  Cancelled: never;
}

export type ValidMissionStatusTransition<From extends MissionStatus = MissionStatus> =
  MissionStatusTransitionMap[From];

export const MISSION_STATUS_TRANSITIONS: Readonly<Record<MissionStatus, readonly MissionStatus[]>> =
  {
    Pending: ['Dispatched', 'Cancelled'],
    Dispatched: ['Executing', 'Cancelled', 'Failed'],
    Executing: ['WaitingPreemption', 'Succeeded', 'Failed', 'Cancelled'],
    WaitingPreemption: ['Executing', 'Cancelled', 'Failed'],
    Succeeded: [],
    Failed: [],
    Cancelled: [],
  } as const;

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = [
  'Succeeded',
  'Failed',
  'Cancelled',
];

export class MissionParseError extends Error {
  public override readonly name = 'MissionParseError';

  public constructor(message: string) {
    super(message);
  }
}

export class MissionStatusTransitionError extends Error {
  public override readonly name = 'MissionStatusTransitionError';
  public readonly from: MissionStatus;
  public readonly to: MissionStatus;

  public constructor(from: MissionStatus, to: MissionStatus) {
    super(`Invalid mission status transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

export function parseMissionV1(value: unknown): MissionV1 {
  const record = readRecord(value, 'Mission', MissionParseError);
  assertSchemaVersion(record, 'Mission');
  const fleetIdRaw = readOptionalString(record, 'fleetId', MissionParseError);

  return {
    schemaVersion: 1,
    missionId: MissionId(readString(record, 'missionId', MissionParseError)),
    robotId: RobotId(readString(record, 'robotId', MissionParseError)),
    ...(fleetIdRaw ? { fleetId: FleetId(fleetIdRaw) } : {}),
    goalSpec: readRecord(record['goalSpec'], 'goalSpec', MissionParseError),
    priority: parseMissionPriority(readString(record, 'priority', MissionParseError)),
    constraints: readRecord(record['constraints'], 'constraints', MissionParseError),
    status: parseMissionStatus(readString(record, 'status', MissionParseError)),
    idempotencyKey: readString(record, 'idempotencyKey', MissionParseError),
  };
}

export function parseActionExecutionV1(value: unknown): ActionExecutionV1 {
  const record = readRecord(value, 'ActionExecution', MissionParseError);
  assertSchemaVersion(record, 'ActionExecution');
  const preemptedAt = readOptionalIsoString(record, 'preemptedAt', MissionParseError);

  return {
    schemaVersion: 1,
    executionId: readString(record, 'executionId', MissionParseError),
    missionId: MissionId(readString(record, 'missionId', MissionParseError)),
    gatewayRef: GatewayId(readString(record, 'gatewayRef', MissionParseError)),
    feedbackLog: parseFeedbackLog(record['feedbackLog']),
    ...(preemptedAt ? { preemptedAt } : {}),
  };
}

export function isValidMissionStatusTransition(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidMissionStatusTransition(from: MissionStatus, to: MissionStatus): void {
  if (!isValidMissionStatusTransition(from, to)) {
    throw new MissionStatusTransitionError(from, to);
  }
}

export function transitionMissionStatusV1(
  mission: MissionV1,
  nextStatus: ValidMissionStatusTransition<typeof mission.status>,
): MissionV1 {
  assertValidMissionStatusTransition(mission.status, nextStatus);
  return { ...mission, status: nextStatus };
}

export function isTerminalMissionStatus(status: MissionStatus): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status);
}

function parseFeedbackLog(value: unknown): readonly ActionExecutionFeedbackEntryV1[] {
  if (!Array.isArray(value)) {
    throw new MissionParseError('feedbackLog must be an array.');
  }

  return value.map((entry, i) => {
    const record = readRecord(entry, `feedbackLog[${i}]`, MissionParseError);
    const levelRaw = readString(record, 'level', MissionParseError);
    if (!(FEEDBACK_LEVELS as readonly string[]).includes(levelRaw)) {
      throw new MissionParseError(
        `feedbackLog[${i}].level must be one of: ${FEEDBACK_LEVELS.join(', ')}.`,
      );
    }

    return {
      at: readIsoString(record, 'at', MissionParseError),
      level: levelRaw as ActionFeedbackLevel,
      message: readString(record, 'message', MissionParseError),
    };
  });
}

function assertSchemaVersion(record: Record<string, unknown>, label: string): void {
  if (record['schemaVersion'] !== 1) {
    throw new MissionParseError(`${label}.schemaVersion must be 1.`);
  }
}

function parseMissionPriority(value: string): MissionPriority {
  if ((MISSION_PRIORITIES as readonly string[]).includes(value)) {
    return value as MissionPriority;
  }
  throw new MissionParseError(`priority must be one of: ${MISSION_PRIORITIES.join(', ')}.`);
}

function parseMissionStatus(value: string): MissionStatus {
  if ((MISSION_STATUSES as readonly string[]).includes(value)) {
    return value as MissionStatus;
  }
  throw new MissionParseError(`status must be one of: ${MISSION_STATUSES.join(', ')}.`);
}
