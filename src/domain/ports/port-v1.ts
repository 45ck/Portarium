import {
  AdapterId,
  PortId,
  WorkspaceId,
  isPortFamily,
  type AdapterId as AdapterIdType,
  type PortId as PortIdType,
  type PortFamily,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  isAllowedPortCapability,
  type PortCapability,
  PORT_FAMILY_CAPABILITIES,
} from './port-family-capabilities-v1.js';
import {
  parseNonEmptyString,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type PortStatus = 'Active' | 'Inactive' | 'Disabled';

export type PortAuthMode = 'none' | 'apiKey' | 'basic' | 'oauth2' | 'serviceAccount' | 'mTLS';

export type PortAuthV1 = Readonly<{
  mode: PortAuthMode;
  scopes?: readonly string[];
}>;

export type PortV1 = Readonly<{
  schemaVersion: 1;
  portId: PortIdType;
  workspaceId: WorkspaceIdType;
  adapterId: AdapterIdType;
  portFamily: PortFamily;
  name: string;
  status: PortStatus;
  supportedOperations: readonly PortCapability[];
  endpoint?: string;
  auth?: PortAuthV1;
  createdAtIso: string;
  updatedAtIso?: string;
}>;

export class PortParseError extends Error {
  public override readonly name = 'PortParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parsePortV1(value: unknown): PortV1 {
  const record = readRecord(value, 'Port', PortParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', PortParseError);
  if (schemaVersion !== 1) {
    throw new PortParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const portId = PortId(readString(record, 'portId', PortParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', PortParseError));
  const adapterId = AdapterId(readString(record, 'adapterId', PortParseError));
  const portFamilyRaw = readString(record, 'portFamily', PortParseError);
  if (!isPortFamily(portFamilyRaw)) {
    throw new PortParseError(
      'portFamily must be one of: FinanceAccounting, PaymentsBilling, ProcurementSpend, HrisHcm, Payroll, CrmSales, CustomerSupport, ItsmItOps, IamDirectory, SecretsVaulting, MarketingAutomation, AdsPlatforms, CommsCollaboration, ProjectsWorkMgmt, DocumentsEsign, AnalyticsBi, MonitoringIncident, ComplianceGrc.',
    );
  }
  const portFamily = portFamilyRaw;

  const name = readString(record, 'name', PortParseError);
  const status = parsePortStatus(readString(record, 'status', PortParseError));

  const supportedOperations = parseOperations(
    record['supportedOperations'],
    'supportedOperations',
    portFamily,
  );
  const endpoint = readOptionalString(record, 'endpoint', PortParseError);
  const authRaw = record['auth'];
  const auth = authRaw === undefined ? undefined : parsePortAuthV1(authRaw);

  const createdAtIso = readIsoString(record, 'createdAtIso', PortParseError);
  const updatedAtIso = readOptionalIsoString(record, 'updatedAtIso', PortParseError);

  return {
    schemaVersion: 1,
    portId,
    workspaceId,
    adapterId,
    portFamily,
    name,
    status,
    supportedOperations,
    ...(endpoint ? { endpoint } : {}),
    ...(auth ? { auth } : {}),
    createdAtIso,
    ...(updatedAtIso ? { updatedAtIso } : {}),
  };
}

function parsePortStatus(raw: string): PortStatus {
  if (raw === 'Active' || raw === 'Inactive' || raw === 'Disabled') {
    return raw;
  }
  throw new PortParseError('status must be one of: Active, Inactive, Disabled.');
}

function parsePortAuthV1(value: unknown): PortAuthV1 {
  const record = readRecord(value, 'auth', PortParseError);

  const modeRaw = readString(record, 'mode', PortParseError);
  if (!isPortAuthMode(modeRaw)) {
    throw new PortParseError(
      'auth.mode must be one of: none, apiKey, basic, oauth2, serviceAccount, mTLS.',
    );
  }
  const mode = modeRaw;

  const scopesRaw = record['scopes'];
  const scopes = scopesRaw === undefined ? undefined : parseScopes(scopesRaw);

  return {
    mode,
    ...(scopes ? { scopes } : {}),
  };
}

function parseScopes(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    throw new PortParseError('auth.scopes must be an array.');
  }

  const seen = new Set<string>();
  const scopes: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = parseNonEmptyString(
      (value as readonly unknown[])[i],
      `auth.scopes[${i}]`,
      PortParseError,
    );
    if (seen.has(raw)) {
      throw new PortParseError(`auth.scopes must not contain duplicates.`);
    }
    seen.add(raw);
    scopes.push(raw);
  }

  return scopes;
}

function parseOperations(
  value: unknown,
  key: string,
  portFamily: PortFamily,
): readonly PortCapability[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new PortParseError(`${key} must be a non-empty array.`);
  }

  const seen = new Set<string>();
  const out: PortCapability[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const raw = parseNonEmptyString(
      (value as readonly unknown[])[i],
      `${key}[${i}]`,
      PortParseError,
    );
    if (!raw.includes(':')) {
      throw new PortParseError(`${key}[${i}] must be in <noun>:<action> format.`);
    }

    if (!isAllowedPortCapability(portFamily, raw)) {
      const known = PORT_FAMILY_CAPABILITIES[portFamily].join(', ');
      throw new PortParseError(
        `${key}[${i}] value '${raw}' is not supported for port family ${portFamily}. Supported values are: ${known}`,
      );
    }
    if (seen.has(raw)) {
      throw new PortParseError(`${key} must not contain duplicates.`);
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function isPortAuthMode(value: string): value is PortAuthMode {
  return (
    value === 'none' ||
    value === 'apiKey' ||
    value === 'basic' ||
    value === 'oauth2' ||
    value === 'serviceAccount' ||
    value === 'mTLS'
  );
}
