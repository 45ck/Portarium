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
  if (!isRecord(value)) {
    throw new PortParseError('Port must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new PortParseError(`Unsupported schemaVersion: ${schemaVersion}`);
  }

  const portId = PortId(readString(value, 'portId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const adapterId = AdapterId(readString(value, 'adapterId'));
  const portFamilyRaw = readString(value, 'portFamily');
  if (!isPortFamily(portFamilyRaw)) {
    throw new PortParseError(
      'portFamily must be one of: FinanceAccounting, PaymentsBilling, ProcurementSpend, HrisHcm, Payroll, CrmSales, CustomerSupport, ItsmItOps, IamDirectory, SecretsVaulting, MarketingAutomation, AdsPlatforms, CommsCollaboration, ProjectsWorkMgmt, DocumentsEsign, AnalyticsBi, MonitoringIncident, ComplianceGrc.',
    );
  }
  const portFamily = portFamilyRaw;

  const name = readString(value, 'name');
  const status = parsePortStatus(readString(value, 'status'));

  const supportedOperations = parseOperations(
    readAny(value, 'supportedOperations'),
    'supportedOperations',
    portFamily,
  );
  const endpoint = readOptionalString(value, 'endpoint');
  const authRaw = value['auth'];
  const auth = authRaw === undefined ? undefined : parsePortAuthV1(authRaw);

  const createdAtIso = readString(value, 'createdAtIso');
  parseIsoString(createdAtIso, 'createdAtIso');
  const updatedAtIso = readOptionalString(value, 'updatedAtIso');
  if (updatedAtIso !== undefined) {
    parseIsoString(updatedAtIso, 'updatedAtIso');
  }

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
  if (!isRecord(value)) throw new PortParseError('auth must be an object.');

  const modeRaw = readString(value, 'mode');
  if (!isPortAuthMode(modeRaw)) {
    throw new PortParseError(
      'auth.mode must be one of: none, apiKey, basic, oauth2, serviceAccount, mTLS.',
    );
  }
  const mode = modeRaw;

  const scopesRaw = value['scopes'];
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
    const raw = (value as readonly unknown[])[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new PortParseError(`auth.scopes[${i}] must be a non-empty string.`);
    }
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
    const raw = (value as readonly unknown[])[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new PortParseError(`${key}[${i}] must be a non-empty string.`);
    }
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

function readAny(value: Record<string, unknown>, key: string): unknown {
  return value[key];
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PortParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PortParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new PortParseError(`${key} must be an integer.`);
  }
  return value;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PortParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
