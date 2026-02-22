/**
 * Open-RMF fleet coordination ingest adapter.
 *
 * Translates Open-RMF (Open Robotics Middleware Framework) fleet state and
 * task dispatch messages into Portarium domain types. Open-RMF uses ROS 2
 * topics (bridged via rosbridge or REST API) for multi-robot fleet coordination,
 * traffic management, and task scheduling.
 *
 * Message formats are based on the rmf_fleet_msgs and rmf_task_msgs ROS 2
 * message packages (open-rmf/rmf_ros2 v2.x).
 *
 * Portarium does NOT manage the ROS 2 / rosbridge subscription — the caller
 * receives raw JSON-decoded message payloads and passes them here.
 *
 * Key message types handled:
 *   - FleetState       → robot positions + battery + mode
 *   - TaskSummary      → task status and assignment
 *   - FleetLog         → fleet-level event log
 *
 * Bead: bead-0530
 */

import type { RobotConnectivityState } from '../../../domain/robots/robot-fleet-v1.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';
import { FleetId, RobotId } from '../../../domain/primitives/index.js';

// ── Open-RMF enumerations ─────────────────────────────────────────────────────

/** RobotMode.mode values from rmf_fleet_msgs/RobotMode. */
export type OpenRmfRobotMode =
  | 'IDLE'
  | 'CHARGING'
  | 'MOVING'
  | 'PAUSING'
  | 'WAITING'
  | 'EMERGENCY'
  | 'GOING_HOME'
  | 'DOCK_CHARGING'
  | 'ADAPTER_ERROR'
  | 'REQUEST_ERROR';

/** TaskSummary.state values from rmf_task_msgs/TaskSummary. */
export type OpenRmfTaskState =
  | 'PENDING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED'
  | 'KILLED';

// ── Open-RMF message types ────────────────────────────────────────────────────

/** RobotState from rmf_fleet_msgs/RobotState. */
export interface OpenRmfRobotState {
  name: string;
  model: string;
  task_id: string;
  seq: number;
  mode: {
    mode: number; // enum ordinal
    mode_request_id?: number;
  };
  battery_percent: number;
  location: {
    t: { sec: number; nanosec: number };
    x: number;
    y: number;
    yaw: number;
    obey_approach_speed_limit: boolean;
    approach_speed_limit?: number;
    level_name: string;
    index?: number;
  };
  path: unknown[];
}

/** FleetState from rmf_fleet_msgs/FleetState. */
export interface OpenRmfFleetState {
  name: string;
  robots: OpenRmfRobotState[];
}

/** TaskSummary from rmf_task_msgs/TaskSummary (Open-RMF v2 REST API variant). */
export interface OpenRmfTaskSummary {
  task_id: string;
  fleet_name?: string;
  robot_name?: string;
  /** ISO 8601 timestamp. */
  submitted_time?: string;
  start_time?: string;
  end_time?: string;
  state: string; // OpenRmfTaskState value
  description?: string;
  status?: string;
}

/** Open-RMF v2 API robot summary (from /robots endpoint). */
export interface OpenRmfApiRobotSummary {
  fleet_name: string;
  robot_name: string;
  status: {
    /** ISO 8601 timestamp. */
    timestamp?: string;
    mode?: string; // OpenRmfRobotMode value
    battery_percent?: number;
    location?: { map: string; x: number; y: number; yaw: number };
    task_id?: string | null;
  };
}

// ── Parse errors ──────────────────────────────────────────────────────────────

export class OpenRmfParseError extends Error {
  public override readonly name = 'OpenRmfParseError';
  public constructor(message: string) {
    super(message);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OpenRmfParseError(`OpenRMF: '${label}' must be a JSON object, got ${typeof value}`);
  }
  return value as Record<string, unknown>;
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new OpenRmfParseError(`OpenRMF: missing or empty field '${key}'`);
  }
  return v;
}

function readArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key];
  if (!Array.isArray(v)) {
    throw new OpenRmfParseError(`OpenRMF: '${key}' must be an array`);
  }
  return v;
}

// ── Robot mode ordinals ───────────────────────────────────────────────────────

/** rmf_fleet_msgs/RobotMode ordinal → symbolic name. */
const ROBOT_MODE_ORDINALS: Record<number, OpenRmfRobotMode> = {
  0: 'IDLE',
  1: 'CHARGING',
  2: 'MOVING',
  3: 'PAUSING',
  4: 'WAITING',
  5: 'EMERGENCY',
  6: 'GOING_HOME',
  7: 'DOCK_CHARGING',
  8: 'ADAPTER_ERROR',
  9: 'REQUEST_ERROR',
};

const TASK_STATE_VALUES = new Set<string>([
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'FAILED',
  'CANCELED',
  'KILLED',
]);

// ── Parsers ───────────────────────────────────────────────────────────────────

/**
 * Parse an Open-RMF FleetState message.
 */
export function parseOpenRmfFleetState(payload: unknown): OpenRmfFleetState {
  const obj = readRecord(payload, 'FleetState');
  readString(obj, 'name');
  readArray(obj, 'robots');
  return obj as unknown as OpenRmfFleetState;
}

/**
 * Parse an Open-RMF TaskSummary message.
 */
export function parseOpenRmfTaskSummary(payload: unknown): OpenRmfTaskSummary {
  const obj = readRecord(payload, 'TaskSummary');
  readString(obj, 'task_id');

  const state = obj['state'];
  if (typeof state !== 'string' || !TASK_STATE_VALUES.has(state)) {
    throw new OpenRmfParseError(
      `OpenRMF: TaskSummary.state must be one of ${[...TASK_STATE_VALUES].join(', ')}, got '${String(state)}'`,
    );
  }
  return obj as unknown as OpenRmfTaskSummary;
}

/**
 * Parse an Open-RMF v2 API robot summary.
 */
export function parseOpenRmfApiRobotSummary(payload: unknown): OpenRmfApiRobotSummary {
  const obj = readRecord(payload, 'ApiRobotSummary');
  readString(obj, 'fleet_name');
  readString(obj, 'robot_name');
  readRecord(obj['status'], 'status');
  return obj as unknown as OpenRmfApiRobotSummary;
}

// ── Domain mapping ────────────────────────────────────────────────────────────

/**
 * Map an Open-RMF robot mode ordinal to Portarium RobotConnectivityState.
 */
export function mapOpenRmfRobotModeToConnectivity(modeOrdinal: number): RobotConnectivityState {
  const mode = ROBOT_MODE_ORDINALS[modeOrdinal] ?? 'ADAPTER_ERROR';
  switch (mode) {
    case 'IDLE':
    case 'CHARGING':
    case 'MOVING':
    case 'PAUSING':
    case 'WAITING':
    case 'GOING_HOME':
    case 'DOCK_CHARGING':
      return 'Online';
    case 'EMERGENCY':
    case 'ADAPTER_ERROR':
    case 'REQUEST_ERROR':
      return 'Degraded';
  }
}

/**
 * Map an Open-RMF task state string to Portarium MissionStatus.
 */
export function mapOpenRmfTaskState(state: OpenRmfTaskState): MissionStatus {
  switch (state) {
    case 'PENDING':
      return 'Dispatched';
    case 'ACTIVE':
      return 'Executing';
    case 'COMPLETED':
      return 'Succeeded';
    case 'FAILED':
      return 'Failed';
    case 'CANCELED':
    case 'KILLED':
      return 'Cancelled';
  }
}

/**
 * Map an Open-RMF robot mode string (from REST API) to Portarium RobotConnectivityState.
 */
export function mapOpenRmfModeStringToConnectivity(mode: string): RobotConnectivityState {
  const m = mode.toUpperCase() as OpenRmfRobotMode;
  switch (m) {
    case 'IDLE':
    case 'CHARGING':
    case 'MOVING':
    case 'PAUSING':
    case 'WAITING':
    case 'GOING_HOME':
    case 'DOCK_CHARGING':
      return 'Online';
    case 'EMERGENCY':
    case 'ADAPTER_ERROR':
    case 'REQUEST_ERROR':
      return 'Degraded';
    default:
      return 'Unknown';
  }
}

// ── ID helpers ────────────────────────────────────────────────────────────────

/**
 * Derive a stable Portarium RobotId from an Open-RMF fleet name + robot name.
 * Format: openrmf/{fleetName}/{robotName}
 */
export function openRmfRobotId(fleetName: string, robotName: string): ReturnType<typeof RobotId> {
  return RobotId(`openrmf/${fleetName}/${robotName}`);
}

/**
 * Derive a Portarium FleetId from an Open-RMF fleet name.
 * Format: openrmf/{fleetName}
 */
export function openRmfFleetId(fleetName: string): ReturnType<typeof FleetId> {
  return FleetId(`openrmf/${fleetName}`);
}

// ── Multi-robot dispatch helpers ──────────────────────────────────────────────

/**
 * Extract all robot identifiers from an Open-RMF FleetState message.
 * Returns an array of { fleetName, robotName } pairs, one per robot.
 */
export function extractFleetRobotIds(
  fleetState: OpenRmfFleetState,
): Array<{ fleetName: string; robotName: string; robotId: ReturnType<typeof RobotId> }> {
  return fleetState.robots.map((r) => ({
    fleetName: fleetState.name,
    robotName: r.name,
    robotId: openRmfRobotId(fleetState.name, r.name),
  }));
}

/**
 * Find the robot in an Open-RMF FleetState currently assigned to a given task_id.
 * Returns null if no robot is executing that task.
 */
export function findRobotByTaskId(
  fleetState: OpenRmfFleetState,
  taskId: string,
): OpenRmfRobotState | null {
  return fleetState.robots.find((r) => r.task_id === taskId) ?? null;
}
