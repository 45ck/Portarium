import {
  FleetId,
  RobotId,
  TenantId,
  type FleetId as FleetIdType,
  type RobotId as RobotIdType,
  type TenantId as TenantIdType,
} from '../primitives/index.js';
import {
  isAllowedPortCapability,
  type PortCapability,
} from '../ports/port-family-capabilities-v1.js';
import {
  readBoolean,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

const ROBOT_CLASSES = ['AMR_AGV', 'Manipulator', 'Aerial', 'FixedAutomation', 'Humanoid'] as const;

const CONNECTIVITY_STATES = ['Online', 'Degraded', 'Offline', 'Unknown'] as const;
const HAZARD_CLASSES = ['Low', 'Medium', 'High', 'Critical'] as const;

export type RobotClass = (typeof ROBOT_CLASSES)[number];
export type RobotConnectivityState = (typeof CONNECTIVITY_STATES)[number];
export type HazardClass = (typeof HAZARD_CLASSES)[number];

export type RobotSafetyProfileV1 = Readonly<{
  hazardClass: HazardClass;
  estopSupported: boolean;
  humanOverrideRequired: boolean;
}>;

export type RobotV1 = Readonly<{
  schemaVersion: 1;
  robotId: RobotIdType;
  fleetId: FleetIdType;
  displayName: string;
  robotClass: RobotClass;
  capabilities: readonly PortCapability[];
  safetyProfile: RobotSafetyProfileV1;
  softwareVersion: string;
  connectivityState: RobotConnectivityState;
}>;

export type FleetV1 = Readonly<{
  schemaVersion: 1;
  fleetId: FleetIdType;
  tenantId: TenantIdType;
  siteZone: string;
  sharedPolicies: readonly string[];
}>;

export class RobotFleetParseError extends Error {
  public override readonly name = 'RobotFleetParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseRobotV1(value: unknown): RobotV1 {
  const record = readRecord(value, 'Robot', RobotFleetParseError);
  assertSchemaVersion(record, 'Robot');

  const robotClass = parseRobotClass(readString(record, 'robotClass', RobotFleetParseError));
  const connectivityState = parseConnectivityState(
    readString(record, 'connectivityState', RobotFleetParseError),
  );

  return {
    schemaVersion: 1,
    robotId: RobotId(readString(record, 'robotId', RobotFleetParseError)),
    fleetId: FleetId(readString(record, 'fleetId', RobotFleetParseError)),
    displayName: readString(record, 'displayName', RobotFleetParseError),
    robotClass,
    capabilities: parseRobotCapabilities(record['capabilities']),
    safetyProfile: parseSafetyProfile(record['safetyProfile']),
    softwareVersion: readString(record, 'softwareVersion', RobotFleetParseError),
    connectivityState,
  };
}

export function parseFleetV1(value: unknown): FleetV1 {
  const record = readRecord(value, 'Fleet', RobotFleetParseError);
  assertSchemaVersion(record, 'Fleet');

  return {
    schemaVersion: 1,
    fleetId: FleetId(readString(record, 'fleetId', RobotFleetParseError)),
    tenantId: TenantId(readString(record, 'tenantId', RobotFleetParseError)),
    siteZone: readString(record, 'siteZone', RobotFleetParseError),
    sharedPolicies: parseSharedPolicies(record['sharedPolicies']),
  };
}

function assertSchemaVersion(record: Record<string, unknown>, label: string): void {
  if (record['schemaVersion'] !== 1) {
    throw new RobotFleetParseError(`${label}.schemaVersion must be 1.`);
  }
}

function parseRobotClass(value: string): RobotClass {
  if ((ROBOT_CLASSES as readonly string[]).includes(value)) {
    return value as RobotClass;
  }
  throw new RobotFleetParseError(`robotClass must be one of: ${ROBOT_CLASSES.join(', ')}.`);
}

function parseConnectivityState(value: string): RobotConnectivityState {
  if ((CONNECTIVITY_STATES as readonly string[]).includes(value)) {
    return value as RobotConnectivityState;
  }
  throw new RobotFleetParseError(
    `connectivityState must be one of: ${CONNECTIVITY_STATES.join(', ')}.`,
  );
}

function parseSafetyProfile(value: unknown): RobotSafetyProfileV1 {
  const record = readRecord(value, 'safetyProfile', RobotFleetParseError);
  const hazardClassRaw = readString(record, 'hazardClass', RobotFleetParseError);
  if (!(HAZARD_CLASSES as readonly string[]).includes(hazardClassRaw)) {
    throw new RobotFleetParseError(
      `safetyProfile.hazardClass must be one of: ${HAZARD_CLASSES.join(', ')}.`,
    );
  }

  return {
    hazardClass: hazardClassRaw as HazardClass,
    estopSupported: readBoolean(record, 'estopSupported', RobotFleetParseError),
    humanOverrideRequired: readBoolean(record, 'humanOverrideRequired', RobotFleetParseError),
  };
}

function parseRobotCapabilities(value: unknown): readonly PortCapability[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RobotFleetParseError('capabilities must be a non-empty array.');
  }

  const seen = new Set<string>();
  const out: PortCapability[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = readString({ value: value[i] }, 'value', RobotFleetParseError, {
      path: `capabilities[${i}]`,
    });
    if (!isAllowedPortCapability('RoboticsActuation', raw)) {
      throw new RobotFleetParseError(
        `capabilities[${i}] '${raw}' is not a RoboticsActuation capability.`,
      );
    }
    if (seen.has(raw)) {
      throw new RobotFleetParseError('capabilities must not contain duplicates.');
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function parseSharedPolicies(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new RobotFleetParseError('sharedPolicies must be an array.');
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const parsed = readOptionalString({ value: value[i] }, 'value', RobotFleetParseError, {
      path: `sharedPolicies[${i}]`,
    });
    if (parsed === undefined) {
      throw new RobotFleetParseError(`sharedPolicies[${i}] must be a non-empty string.`);
    }
    if (!seen.has(parsed)) {
      seen.add(parsed);
      out.push(parsed);
    }
  }
  return out;
}
