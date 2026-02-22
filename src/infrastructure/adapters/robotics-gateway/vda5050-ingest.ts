/**
 * VDA 5050 ingest adapter.
 *
 * Translates VDA 5050 v2.0 AGV state and connection messages into Portarium
 * domain types (RobotV1, MissionStatus). VDA 5050 is the German VDMA/VDA
 * standard for AGV fleet communication over MQTT.
 *
 * Standard reference: VDA 5050 v2.0 (2022-12)
 *   Topic pattern: {interfaceName}/{vdaVersion}/{manufacturer}/{serialNumber}/{topic}
 *   Canonical prefix: uagv/v2/
 *
 * Portarium does NOT manage the MQTT subscription — the caller receives
 * raw message payloads and passes them to the parse functions here.
 *
 * Bead: bead-0567
 */

import type { RobotConnectivityState } from '../../../domain/robots/robot-fleet-v1.js';
import type { MissionStatus } from '../../../domain/robots/mission-v1.js';
import { FleetId, RobotId } from '../../../domain/primitives/index.js';

// ── VDA 5050 message types (minimal subset) ───────────────────────────────────

/** VDA 5050 connection state values. */
export type Vda5050ConnectionState = 'ONLINE' | 'OFFLINE' | 'CONNECTIONBROKEN';

/** VDA 5050 action status. */
export type Vda5050ActionStatus =
  | 'WAITING'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'PAUSED'
  | 'FINISHED'
  | 'FAILED';

/** VDA 5050 action result (v2.0 actionState). */
export interface Vda5050ActionState {
  actionId: string;
  actionType: string;
  actionStatus: Vda5050ActionStatus;
  resultDescription?: string;
}

/** VDA 5050 error severity. */
export type Vda5050ErrorLevel = 'WARNING' | 'FATAL';

/** VDA 5050 driving direction. */
export type Vda5050DrivingDirection = 'FORWARD' | 'BACKWARD';

/** VDA 5050 operating mode. */
export type Vda5050OperatingMode = 'AUTOMATIC' | 'SEMIAUTOMATIC' | 'MANUAL' | 'SERVICE' | 'TEACHIN';

/** VDA 5050 state message (state topic). */
export interface Vda5050StateMessage {
  headerId: number;
  timestamp: string;
  version: string;
  manufacturer: string;
  serialNumber: string;
  orderId?: string;
  orderUpdateId?: number;
  lastNodeId?: string;
  lastNodeSequenceId?: number;
  nodeStates?: { nodeId: string; released: boolean; sequenceId: number }[];
  edgeStates?: { edgeId: string; released: boolean; sequenceId: number }[];
  driving: boolean;
  paused?: boolean;
  newBaseRequest?: boolean;
  waitingForInteraction?: boolean;
  distanceSinceLastNode?: number;
  operatingMode: Vda5050OperatingMode;
  batteryState: {
    batteryCharge: number;
    batteryVoltage?: number;
    batteryHealth?: number;
    charging: boolean;
    reach?: number;
  };
  errors: {
    errorType: string;
    errorLevel: Vda5050ErrorLevel;
    errorDescription?: string;
  }[];
  loads?: unknown[];
  actionStates?: Vda5050ActionState[];
  safetyState: {
    eStopActivated: boolean;
    fieldViolation: boolean;
  };
}

/** VDA 5050 connection message. */
export interface Vda5050ConnectionMessage {
  headerId: number;
  timestamp: string;
  version: string;
  manufacturer: string;
  serialNumber: string;
  connectionState: Vda5050ConnectionState;
}

// ── Parse errors ──────────────────────────────────────────────────────────────

export class Vda5050ParseError extends Error {
  public override readonly name = 'Vda5050ParseError';
  public constructor(message: string) {
    super(message);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Vda5050ParseError(`VDA5050: missing or empty field '${key}'`);
  }
  return v;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Vda5050ParseError(`VDA5050: '${label}' must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

// ── State message parser ──────────────────────────────────────────────────────

/**
 * Parse a VDA 5050 state message from a raw JSON payload.
 * Throws Vda5050ParseError for required field violations.
 */
export function parseVda5050StateMessage(payload: unknown): Vda5050StateMessage {
  const obj = readRecord(payload, 'state message');

  readString(obj, 'manufacturer');
  readString(obj, 'serialNumber');

  if (typeof obj['driving'] !== 'boolean') {
    throw new Vda5050ParseError("VDA5050: 'driving' must be a boolean");
  }

  const battery = readRecord(obj['batteryState'], 'batteryState');
  if (typeof battery['batteryCharge'] !== 'number') {
    throw new Vda5050ParseError('VDA5050: batteryState.batteryCharge must be a number');
  }

  const safety = readRecord(obj['safetyState'], 'safetyState');
  if (typeof safety['eStopActivated'] !== 'boolean') {
    throw new Vda5050ParseError('VDA5050: safetyState.eStopActivated must be a boolean');
  }

  return obj as unknown as Vda5050StateMessage;
}

/**
 * Parse a VDA 5050 connection message.
 */
export function parseVda5050ConnectionMessage(payload: unknown): Vda5050ConnectionMessage {
  const obj = readRecord(payload, 'connection message');
  readString(obj, 'manufacturer');
  readString(obj, 'serialNumber');

  const state = obj['connectionState'];
  const VALID: Vda5050ConnectionState[] = ['ONLINE', 'OFFLINE', 'CONNECTIONBROKEN'];
  if (!VALID.includes(state as Vda5050ConnectionState)) {
    throw new Vda5050ParseError(
      `VDA5050: connectionState must be one of ${VALID.join(', ')}, got '${String(state)}'`,
    );
  }
  return obj as unknown as Vda5050ConnectionMessage;
}

// ── Domain mapping ────────────────────────────────────────────────────────────

/**
 * Map a VDA 5050 connectionState to Portarium RobotConnectivityState.
 */
export function mapVda5050ConnectionState(state: Vda5050ConnectionState): RobotConnectivityState {
  switch (state) {
    case 'ONLINE':
      return 'Online';
    case 'OFFLINE':
      return 'Offline';
    case 'CONNECTIONBROKEN':
      return 'Degraded';
  }
}

/**
 * Map a VDA 5050 action status to Portarium MissionStatus.
 * Only called when the AGV is executing a Portarium-dispatched order.
 */
export function mapVda5050ActionStatus(status: Vda5050ActionStatus): MissionStatus {
  switch (status) {
    case 'WAITING':
    case 'INITIALIZING':
      return 'Dispatched';
    case 'RUNNING':
      return 'Executing';
    case 'PAUSED':
      return 'WaitingPreemption';
    case 'FINISHED':
      return 'Succeeded';
    case 'FAILED':
      return 'Failed';
  }
}

// ── Topic parsing ─────────────────────────────────────────────────────────────

export interface Vda5050TopicParts {
  interfaceName: string;
  vdaVersion: string;
  manufacturer: string;
  serialNumber: string;
  subtopic: string;
}

/**
 * Parse a VDA 5050 MQTT topic string into its constituent parts.
 *
 * Format: {interfaceName}/{vdaVersion}/{manufacturer}/{serialNumber}/{subtopic}
 * Example: uagv/v2/KUKA/AGV-001/state
 */
export function parseVda5050Topic(topic: string): Vda5050TopicParts {
  const parts = topic.split('/');
  if (parts.length < 5) {
    throw new Vda5050ParseError(
      `VDA5050: topic '${topic}' has fewer than 5 segments (expected interfaceName/version/manufacturer/serialNumber/subtopic)`,
    );
  }
  return {
    interfaceName: parts[0]!,
    vdaVersion: parts[1]!,
    manufacturer: parts[2]!,
    serialNumber: parts[3]!,
    subtopic: parts.slice(4).join('/'),
  };
}

/**
 * Derive a stable Portarium RobotId from a VDA 5050 manufacturer + serialNumber.
 * Format: vda5050/{manufacturer}/{serialNumber}
 */
export function vda5050RobotId(
  manufacturer: string,
  serialNumber: string,
): ReturnType<typeof RobotId> {
  return RobotId(`vda5050/${manufacturer}/${serialNumber}`);
}

/**
 * Derive a Portarium FleetId from a VDA 5050 manufacturer.
 * All robots from the same manufacturer share a fleet namespace.
 */
export function vda5050FleetId(manufacturer: string): ReturnType<typeof FleetId> {
  return FleetId(`vda5050/${manufacturer}`);
}
