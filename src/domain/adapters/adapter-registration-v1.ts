import {
  AdapterId,
  MachineId,
  WorkspaceId,
  isPortFamily,
  type MachineId as MachineIdType,
  type PortFamily,
  type WorkspaceId as WorkspaceIdType,
  type AdapterId as AdapterIdType,
} from '../primitives/index.js';
import {
  isAllowedPortCapability,
  type PortCapability,
  PORT_FAMILY_CAPABILITIES,
} from '../ports/port-family-capabilities-v1.js';
import {
  parseRecord,
  readBoolean,
  readInteger,
  readOptionalString,
  readRecordField,
  readRecord,
  readString,
  readStringArray,
} from '../validation/parse-utils.js';

export type CapabilityClaimV1 = Readonly<{
  capability?: PortCapability;
  operation: string;
  requiresAuth: boolean;
  inputKind?: string;
  outputKind?: string;
}>;

export type AdapterMachineEntryV1 = Readonly<{
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
  executionPolicy: AdapterExecutionPolicyV1;
  machineRegistrations?: readonly AdapterMachineEntryV1[];
}>;

export type AdapterExecutionPolicyV1 = Readonly<{
  tenantIsolationMode: 'PerTenantWorker';
  egressAllowlist: readonly string[];
  credentialScope: 'capabilityMatrix';
  sandboxVerified: true;
  sandboxAvailable: boolean;
}>;

export class AdapterRegistrationParseError extends Error {
  public override readonly name = 'AdapterRegistrationParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseAdapterRegistrationV1(value: unknown): AdapterRegistrationV1 {
  const record = readRecord(value, 'AdapterRegistration', AdapterRegistrationParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', AdapterRegistrationParseError);
  if (schemaVersion !== 1) {
    throw new AdapterRegistrationParseError('schemaVersion must be 1.');
  }

  const adapterId = AdapterId(readString(record, 'adapterId', AdapterRegistrationParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', AdapterRegistrationParseError));
  const providerSlug = readString(record, 'providerSlug', AdapterRegistrationParseError);

  const portFamilyRaw = readString(record, 'portFamily', AdapterRegistrationParseError);
  if (!isPortFamily(portFamilyRaw)) {
    throw new AdapterRegistrationParseError(`Invalid portFamily: "${portFamilyRaw}"`);
  }

  const enabled = readBoolean(record, 'enabled', AdapterRegistrationParseError);
  const capabilityMatrix = parseCapabilityMatrix(record['capabilityMatrix'], portFamilyRaw);
  const executionPolicy = parseExecutionPolicy(record);
  const machineRegistrations = parseMachineRegistrations(record['machineRegistrations']);

  return {
    schemaVersion: 1,
    adapterId,
    workspaceId,
    providerSlug,
    portFamily: portFamilyRaw,
    enabled,
    capabilityMatrix,
    executionPolicy,
    ...(machineRegistrations !== undefined ? { machineRegistrations } : {}),
  };
}

function parseCapabilityMatrix(raw: unknown, portFamily: PortFamily): readonly CapabilityClaimV1[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AdapterRegistrationParseError('capabilityMatrix must be a non-empty array.');
  }

  return raw.map((item, i) => parseCapability(item, `capabilityMatrix[${i}]`, portFamily));
}

function parseCapability(raw: unknown, path: string, portFamily: PortFamily): CapabilityClaimV1 {
  const record = parseRecord(raw, path, AdapterRegistrationParseError);
  const capability = parseOptionalCapability(record);
  const operation = parseOperation(record, path, capability);
  const requiresAuth = readBoolean(record, 'requiresAuth', AdapterRegistrationParseError);
  const inputKind = readOptionalString(record, 'inputKind', AdapterRegistrationParseError);
  const outputKind = readOptionalString(record, 'outputKind', AdapterRegistrationParseError);

  if (capability !== undefined) {
    if (!isAllowedPortCapability(portFamily, capability)) {
      const known = PORT_FAMILY_CAPABILITIES[portFamily].join(', ');
      throw new AdapterRegistrationParseError(
        `${path}.capability '${String(capability)}' is not supported for port family ${portFamily}. Supported values are: ${known}`,
      );
    }
    return {
      ...(capability !== undefined ? { capability } : {}),
      operation: capability,
      requiresAuth,
      ...(inputKind !== undefined ? { inputKind } : {}),
      ...(outputKind !== undefined ? { outputKind } : {}),
    };
  }

  if (operation === undefined) {
    throw new AdapterRegistrationParseError(`${path} must specify either capability or operation.`);
  }

  return {
    operation,
    requiresAuth,
    ...(inputKind !== undefined ? { inputKind } : {}),
    ...(outputKind !== undefined ? { outputKind } : {}),
  };
}

function parseOptionalCapability(record: Record<string, unknown>): PortCapability | undefined {
  const value = readOptionalString(record, 'capability', AdapterRegistrationParseError);
  return value === undefined ? undefined : (value as PortCapability);
}

function parseOperation(
  record: Record<string, unknown>,
  path: string,
  capability?: PortCapability,
): string | undefined {
  const operation = readOptionalString(record, 'operation', AdapterRegistrationParseError);
  if (operation === undefined) return undefined;

  if (capability !== undefined && operation !== capability) {
    throw new AdapterRegistrationParseError(
      `${path}.operation must match capability when both are provided.`,
    );
  }

  if (!capability && !/^[^:\s]+:[^:\s]+$/.test(operation)) {
    throw new AdapterRegistrationParseError(`${path}.operation must match "entity:verb" format.`);
  }

  return operation;
}

function parseMachineRegistrations(raw: unknown): readonly AdapterMachineEntryV1[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new AdapterRegistrationParseError('machineRegistrations must be an array when provided.');
  }

  return raw.map((item, i) => parseMachineRegistration(item, `machineRegistrations[${i}]`));
}

function parseExecutionPolicy(record: Record<string, unknown>): AdapterExecutionPolicyV1 {
  const executionPolicy = readRecordField(record, 'executionPolicy', AdapterRegistrationParseError);
  const tenantIsolationMode = readString(
    executionPolicy,
    'tenantIsolationMode',
    AdapterRegistrationParseError,
  );
  if (tenantIsolationMode !== 'PerTenantWorker') {
    throw new AdapterRegistrationParseError(
      'executionPolicy.tenantIsolationMode must be "PerTenantWorker".',
    );
  }

  const egressAllowlist = readStringArray(
    executionPolicy,
    'egressAllowlist',
    AdapterRegistrationParseError,
    { minLength: 1 },
  );
  for (const egress of egressAllowlist) {
    assertHttpsEndpoint(egress, 'executionPolicy.egressAllowlist');
  }

  const credentialScope = readString(
    executionPolicy,
    'credentialScope',
    AdapterRegistrationParseError,
  );
  if (credentialScope !== 'capabilityMatrix') {
    throw new AdapterRegistrationParseError(
      'executionPolicy.credentialScope must be "capabilityMatrix".',
    );
  }

  const sandboxVerified = readBoolean(
    executionPolicy,
    'sandboxVerified',
    AdapterRegistrationParseError,
  );
  if (!sandboxVerified) {
    throw new AdapterRegistrationParseError('executionPolicy.sandboxVerified must be true.');
  }

  const sandboxAvailable = readBoolean(
    executionPolicy,
    'sandboxAvailable',
    AdapterRegistrationParseError,
  );

  return {
    tenantIsolationMode,
    egressAllowlist,
    credentialScope,
    sandboxVerified: true,
    sandboxAvailable,
  };
}

function parseMachineRegistration(raw: unknown, path: string): AdapterMachineEntryV1 {
  const record = parseRecord(raw, path, AdapterRegistrationParseError);
  const machineId = MachineId(
    readString(record, 'machineId', AdapterRegistrationParseError, { path }),
  );
  const endpointUrl = readString(record, 'endpointUrl', AdapterRegistrationParseError, { path });
  if (!endpointUrl.startsWith('http://') && !endpointUrl.startsWith('https://')) {
    throw new AdapterRegistrationParseError(
      `${path}.endpointUrl must start with http:// or https://.`,
    );
  }
  const active = readBoolean(record, 'active', AdapterRegistrationParseError);
  const displayName = readOptionalString(record, 'displayName', AdapterRegistrationParseError, {
    path,
  });
  const authHint = readOptionalString(record, 'authHint', AdapterRegistrationParseError, { path });

  return {
    machineId,
    endpointUrl,
    active,
    ...(displayName ? { displayName } : {}),
    ...(authHint ? { authHint } : {}),
  };
}

function assertHttpsEndpoint(value: string, fieldName: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AdapterRegistrationParseError(`${fieldName} entries must be valid URLs.`);
  }

  if (url.protocol !== 'https:') {
    throw new AdapterRegistrationParseError(`${fieldName} entries must use https URLs.`);
  }
}
