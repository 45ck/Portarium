import {
  MachineId,
  WorkspaceId,
  type MachineId as MachineIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type MachineRegistrationV1 = Readonly<{
  schemaVersion: 1;
  machineId: MachineIdType;
  workspaceId: WorkspaceIdType;
  endpointUrl: string;
  active: boolean;
  displayName: string;
  capabilities: readonly string[];
  registeredAtIso: string;
}>;

export class MachineRegistrationParseError extends Error {
  public override readonly name = 'MachineRegistrationParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseMachineRegistrationV1(value: unknown): MachineRegistrationV1 {
  if (!isRecord(value)) {
    throw new MachineRegistrationParseError('MachineRegistration must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new MachineRegistrationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const machineId = MachineId(readString(value, 'machineId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const endpointUrl = readString(value, 'endpointUrl');

  if (typeof value['active'] !== 'boolean') {
    throw new MachineRegistrationParseError('active must be a boolean.');
  }
  const active: boolean = value['active'];

  const displayName = readString(value, 'displayName');
  const capabilities = parseCapabilities(value['capabilities']);

  const registeredAtIso = readString(value, 'registeredAtIso');
  parseIsoString(registeredAtIso, 'registeredAtIso');

  return {
    schemaVersion: 1,
    machineId,
    workspaceId,
    endpointUrl,
    active,
    displayName,
    capabilities,
    registeredAtIso,
  };
}

function parseCapabilities(raw: unknown): readonly string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new MachineRegistrationParseError('capabilities must be a non-empty array.');
  }

  return raw.map((item: unknown, i: number) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new MachineRegistrationParseError(
        `capabilities[${i}] must be a non-empty string.`,
      );
    }
    return item;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new MachineRegistrationParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new MachineRegistrationParseError(`${key} must be an integer.`);
  }
  return v;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MachineRegistrationParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
