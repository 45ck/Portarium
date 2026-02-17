import {
  AdapterId,
  CredentialGrantId,
  WorkspaceId,
  type AdapterId as AdapterIdType,
  type CredentialGrantId as CredentialGrantIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type CredentialGrantV1 = Readonly<{
  schemaVersion: 1;
  credentialGrantId: CredentialGrantIdType;
  workspaceId: WorkspaceIdType;
  adapterId: AdapterIdType;
  credentialsRef: string;
  scope: string;
  issuedAtIso: string;
  expiresAtIso?: string;
  lastRotatedAtIso?: string;
  revokedAtIso?: string;
}>;

export class CredentialGrantParseError extends Error {
  public override readonly name = 'CredentialGrantParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseCredentialGrantV1(value: unknown): CredentialGrantV1 {
  if (!isRecord(value)) {
    throw new CredentialGrantParseError('CredentialGrant must be an object.');
  }

  if (value['schemaVersion'] !== 1) {
    throw new CredentialGrantParseError('schemaVersion must be 1.');
  }

  const credentialGrantId = CredentialGrantId(readString(value, 'credentialGrantId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const adapterId = AdapterId(readString(value, 'adapterId'));
  const credentialsRef = readString(value, 'credentialsRef');
  const scope = readString(value, 'scope');
  const issuedAtIso = readString(value, 'issuedAtIso');
  const expiresAtIso = readOptionalString(value, 'expiresAtIso');
  const lastRotatedAtIso = readOptionalString(value, 'lastRotatedAtIso');
  const revokedAtIso = readOptionalString(value, 'revokedAtIso');

  if (revokedAtIso !== undefined && revokedAtIso < issuedAtIso) {
    throw new CredentialGrantParseError('revokedAtIso must not precede issuedAtIso.');
  }

  return {
    schemaVersion: 1,
    credentialGrantId,
    workspaceId,
    adapterId,
    credentialsRef,
    scope,
    issuedAtIso,
    ...(expiresAtIso !== undefined ? { expiresAtIso } : {}),
    ...(lastRotatedAtIso !== undefined ? { lastRotatedAtIso } : {}),
    ...(revokedAtIso !== undefined ? { revokedAtIso } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CredentialGrantParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new CredentialGrantParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
