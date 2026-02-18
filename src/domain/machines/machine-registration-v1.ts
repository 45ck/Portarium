import {
  MachineId,
  WorkspaceId,
  type MachineId as MachineIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readBoolean,
  readInteger,
  readIsoString,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'MachineRegistration', MachineRegistrationParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', MachineRegistrationParseError);
  if (schemaVersion !== 1) {
    throw new MachineRegistrationParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const machineId = MachineId(readString(record, 'machineId', MachineRegistrationParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', MachineRegistrationParseError));
  const endpointUrl = readString(record, 'endpointUrl', MachineRegistrationParseError);
  const active = readBoolean(record, 'active', MachineRegistrationParseError);
  const displayName = readString(record, 'displayName', MachineRegistrationParseError);
  const capabilities = readStringArray(record, 'capabilities', MachineRegistrationParseError, {
    minLength: 1,
  });
  const registeredAtIso = readIsoString(record, 'registeredAtIso', MachineRegistrationParseError);

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
