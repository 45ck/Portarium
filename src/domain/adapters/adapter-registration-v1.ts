import {
  AdapterId,
  MachineId,
  WorkspaceId,
  type AdapterId as AdapterIdType,
  type MachineId as MachineIdType,
  type PortFamily,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import { isPortFamily } from '../primitives/index.js';

export type CapabilityClaimV1 = Readonly<{
  operation: string;
  requiresAuth: boolean;
  inputKind?: string;
  outputKind?: string;
}>;

export type MachineRegistrationV1 = Readonly<{
  machineId: MachineIdType;
  endpointUrl: string;
  active: boolean;
  displayName?: string;
  authHint?: string;
}>;

export type AdapterRegistrationV1 = Readonly<{
  schemaVersion: 1;
  adapterId: AdapterIdType;
  workspaceId: WorkspaceIdType;
  providerSlug: string;
  portFamily: PortFamily;
  enabled: boolean;
  capabilityMatrix: readonly CapabilityClaimV1[];
  machineRegistrations?: readonly MachineRegistrationV1[];
}>;

export class AdapterRegistrationParseError extends Error {
  public override readonly name = 'AdapterRegistrationParseError';

  public constructor(message: string) {
    super(message);
  }
}

const OPERATION_RE = /^[a-z]+:[a-z]+$/;

export function parseAdapterRegistrationV1(value: unknown): AdapterRegistrationV1 {
  if (!isRecord(value)) {
    throw new AdapterRegistrationParseError('AdapterRegistration must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new AdapterRegistrationParseError('schemaVersion must be 1.');
  }

  const adapterId = AdapterId(readString(value, 'adapterId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const providerSlug = readString(value, 'providerSlug');

  const portFamilyRaw = readString(value, 'portFamily');
  if (!isPortFamily(portFamilyRaw)) {
    throw new AdapterRegistrationParseError(`Invalid portFamily: "${portFamilyRaw}"`);
  }

  if (typeof value['enabled'] !== 'boolean') {
    throw new AdapterRegistrationParseError('enabled must be a boolean.');
  }
  const enabled: boolean = value['enabled'];

  const capabilityMatrix = parseCapabilityMatrix(value['capabilityMatrix']);
  const machineRegistrations = parseMachineRegistrations(value['machineRegistrations']);

  return {
    schemaVersion: 1,
    adapterId,
    workspaceId,
    providerSlug,
    portFamily: portFamilyRaw,
    enabled,
    capabilityMatrix,
    ...(machineRegistrations !== undefined ? { machineRegistrations } : {}),
  };
}

function parseCapabilityMatrix(raw: unknown): readonly CapabilityClaimV1[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AdapterRegistrationParseError('capabilityMatrix must be a non-empty array.');
  }

  return raw.map((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new AdapterRegistrationParseError(`capabilityMatrix[${i}] must be an object.`);
    }

    const operation = readCapString(item, 'operation', i);
    if (!OPERATION_RE.test(operation)) {
      throw new AdapterRegistrationParseError(
        `capabilityMatrix[${i}].operation must match "entity:verb" format.`,
      );
    }

    if (typeof item['requiresAuth'] !== 'boolean') {
      throw new AdapterRegistrationParseError(
        `capabilityMatrix[${i}].requiresAuth must be a boolean.`,
      );
    }
    const requiresAuth: boolean = item['requiresAuth'];

    const inputKind = readCapOptionalString(item, 'inputKind', i);
    const outputKind = readCapOptionalString(item, 'outputKind', i);

    return {
      operation,
      requiresAuth,
      ...(inputKind !== undefined ? { inputKind } : {}),
      ...(outputKind !== undefined ? { outputKind } : {}),
    };
  });
}

function parseMachineRegistrations(raw: unknown): readonly MachineRegistrationV1[] | undefined {
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    throw new AdapterRegistrationParseError('machineRegistrations must be an array when provided.');
  }

  return raw.map((item: unknown, i: number) => {
    if (!isRecord(item)) {
      throw new AdapterRegistrationParseError(`machineRegistrations[${i}] must be an object.`);
    }

    const machineId = MachineId(readMachineString(item, 'machineId', i));

    const endpointUrl = readMachineString(item, 'endpointUrl', i);
    if (!endpointUrl.startsWith('http://') && !endpointUrl.startsWith('https://')) {
      throw new AdapterRegistrationParseError(
        `machineRegistrations[${i}].endpointUrl must start with http:// or https://.`,
      );
    }

    if (typeof item['active'] !== 'boolean') {
      throw new AdapterRegistrationParseError(
        `machineRegistrations[${i}].active must be a boolean.`,
      );
    }
    const active: boolean = item['active'];

    const displayName = readMachineOptionalString(item, 'displayName', i);
    const authHint = readMachineOptionalString(item, 'authHint', i);

    return {
      machineId,
      endpointUrl,
      active,
      ...(displayName !== undefined ? { displayName } : {}),
      ...(authHint !== undefined ? { authHint } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AdapterRegistrationParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readCapString(obj: Record<string, unknown>, key: string, index: number): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AdapterRegistrationParseError(
      `capabilityMatrix[${index}].${key} must be a non-empty string.`,
    );
  }
  return v;
}

function readCapOptionalString(
  obj: Record<string, unknown>,
  key: string,
  index: number,
): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AdapterRegistrationParseError(
      `capabilityMatrix[${index}].${key} must be a non-empty string when provided.`,
    );
  }
  return v;
}

function readMachineString(obj: Record<string, unknown>, key: string, index: number): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AdapterRegistrationParseError(
      `machineRegistrations[${index}].${key} must be a non-empty string.`,
    );
  }
  return v;
}

function readMachineOptionalString(
  obj: Record<string, unknown>,
  key: string,
  index: number,
): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new AdapterRegistrationParseError(
      `machineRegistrations[${index}].${key} must be a non-empty string when provided.`,
    );
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
