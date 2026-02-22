/**
 * MassRobotics AMR Interoperability Standard ingest adapter.
 *
 * Translates MassRobotics v1.1 location and status payloads into Portarium
 * domain types (RobotConnectivityState, MissionStatus).
 *
 * Standard reference: MassRobotics AMR Interop Standard v1.1
 *   Transport: typically REST/webhook or MQTT
 *   Payload format: JSON with header + status/location sections
 *
 * Portarium does NOT manage the transport subscription — the caller receives
 * raw message payloads and passes them to the parse functions here.
 *
 * Bead: bead-0567
 */

import type { RobotConnectivityState } from '../../../domain/robots/robot-fleet-v1.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';
import { FleetId, RobotId } from '../../../domain/primitives/index.js';

// ── MassRobotics message types ────────────────────────────────────────────────

/** MassRobotics operational state values. */
export type MassRoboticsOperationalState =
  | 'IDLE'
  | 'MOVING'
  | 'CHARGING'
  | 'PAUSED'
  | 'ERROR'
  | 'OFFLINE'
  | 'UNKNOWN';

/** MassRobotics task state values. */
export type MassRoboticsTaskState =
  | 'ASSIGNED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** MassRobotics 2D location. */
export interface MassRoboticsLocation2D {
  x: number;
  y: number;
  angle?: number;
  mapId?: string;
}

/** MassRobotics battery state. */
export interface MassRoboticsBatteryState {
  batteryPercentage: number;
  isCharging: boolean;
}

/** MassRobotics status message (full status report). */
export interface MassRoboticsStatusMessage {
  /** UUID of the reporting robot. */
  robotId: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  operationalState: MassRoboticsOperationalState;
  taskState?: MassRoboticsTaskState;
  /** Vendor-assigned task identifier (maps to Portarium MissionId). */
  taskId?: string;
  location?: MassRoboticsLocation2D;
  batteryState?: MassRoboticsBatteryState;
  /** Manufacturer name. Used for fleet namespace. */
  manufacturer?: string;
  /** Model name of the robot. */
  model?: string;
  /** Human-readable error description if operationalState is ERROR. */
  errorDescription?: string;
  /** Software version string. */
  softwareVersion?: string;
}

/** MassRobotics identity registration message. */
export interface MassRoboticsIdentityMessage {
  robotId: string;
  manufacturer: string;
  model: string;
  softwareVersion?: string;
  supportedInterfaces?: string[];
}

// ── Parse errors ──────────────────────────────────────────────────────────────

export class MassRoboticsParseError extends Error {
  public override readonly name = 'MassRoboticsParseError';
  public constructor(message: string) { super(message); }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MassRoboticsParseError(`MassRobotics: '${label}' must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new MassRoboticsParseError(`MassRobotics: missing or empty field '${key}'`);
  }
  return v;
}

const VALID_OPERATIONAL_STATES: MassRoboticsOperationalState[] = [
  'IDLE', 'MOVING', 'CHARGING', 'PAUSED', 'ERROR', 'OFFLINE', 'UNKNOWN',
];

const VALID_TASK_STATES: MassRoboticsTaskState[] = [
  'ASSIGNED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED',
];

// ── Status message parser ─────────────────────────────────────────────────────

/**
 * Parse a MassRobotics status message from a raw JSON payload.
 * Throws MassRoboticsParseError for required field violations.
 */
export function parseMassRoboticsStatusMessage(payload: unknown): MassRoboticsStatusMessage {
  const obj = readRecord(payload, 'status message');
  readString(obj, 'robotId');
  readString(obj, 'timestamp');

  const opState = obj['operationalState'];
  if (!VALID_OPERATIONAL_STATES.includes(opState as MassRoboticsOperationalState)) {
    throw new MassRoboticsParseError(
      `MassRobotics: operationalState must be one of ${VALID_OPERATIONAL_STATES.join(', ')}, got '${String(opState)}'`,
    );
  }

  const taskState = obj['taskState'];
  if (taskState !== undefined && !VALID_TASK_STATES.includes(taskState as MassRoboticsTaskState)) {
    throw new MassRoboticsParseError(
      `MassRobotics: taskState must be one of ${VALID_TASK_STATES.join(', ')}, got '${String(taskState)}'`,
    );
  }

  return obj as unknown as MassRoboticsStatusMessage;
}

/**
 * Parse a MassRobotics identity message.
 */
export function parseMassRoboticsIdentityMessage(payload: unknown): MassRoboticsIdentityMessage {
  const obj = readRecord(payload, 'identity message');
  readString(obj, 'robotId');
  readString(obj, 'manufacturer');
  readString(obj, 'model');
  return obj as unknown as MassRoboticsIdentityMessage;
}

// ── Domain mapping ────────────────────────────────────────────────────────────

/**
 * Map a MassRobotics operationalState to Portarium RobotConnectivityState.
 */
export function mapMassRoboticsOperationalState(
  state: MassRoboticsOperationalState,
): RobotConnectivityState {
  switch (state) {
    case 'IDLE':
    case 'MOVING':
    case 'CHARGING':
    case 'PAUSED': return 'Online';
    case 'ERROR': return 'Degraded';
    case 'OFFLINE': return 'Offline';
    case 'UNKNOWN': return 'Unknown';
  }
}

/**
 * Map a MassRobotics taskState to Portarium MissionStatus.
 * Returns null if no task is active (taskState absent).
 */
export function mapMassRoboticsTaskState(
  state: MassRoboticsTaskState | undefined,
): MissionStatus | null {
  if (state === undefined) return null;
  switch (state) {
    case 'ASSIGNED': return 'Dispatched';
    case 'EXECUTING': return 'Executing';
    case 'COMPLETED': return 'Succeeded';
    case 'FAILED': return 'Failed';
    case 'CANCELLED': return 'Cancelled';
  }
}

// ── Robot identity helpers ────────────────────────────────────────────────────

/**
 * Derive a stable Portarium RobotId from a MassRobotics robotId UUID.
 * Format: massrobotics/{uuid}
 */
export function massRoboticsRobotId(robotId: string): ReturnType<typeof RobotId> {
  return RobotId(`massrobotics/${robotId}`);
}

/**
 * Derive a Portarium FleetId from a MassRobotics manufacturer name.
 */
export function massRoboticsFleetId(manufacturer: string): ReturnType<typeof FleetId> {
  return FleetId(`massrobotics/${manufacturer}`);
}
