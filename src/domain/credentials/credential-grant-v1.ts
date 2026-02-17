import {
  AdapterId,
  CredentialGrantId,
  WorkspaceId,
  type AdapterId as AdapterIdType,
  type CredentialGrantId as CredentialGrantIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  parseIsoDate,
  readInteger,
  readIsoString,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'CredentialGrant', CredentialGrantParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', CredentialGrantParseError);
  if (schemaVersion !== 1) {
    throw new CredentialGrantParseError('schemaVersion must be 1.');
  }

  const credentialGrantId = CredentialGrantId(
    readString(record, 'credentialGrantId', CredentialGrantParseError),
  );
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', CredentialGrantParseError));
  const adapterId = AdapterId(readString(record, 'adapterId', CredentialGrantParseError));
  const credentialsRef = readString(record, 'credentialsRef', CredentialGrantParseError);
  const scope = readString(record, 'scope', CredentialGrantParseError);
  const issuedAtIso = readIsoString(record, 'issuedAtIso', CredentialGrantParseError);
  const issuedAt = parseIsoDate(issuedAtIso, 'issuedAtIso', CredentialGrantParseError);
  const expiresAtIso = readOptionalIsoString(record, 'expiresAtIso', CredentialGrantParseError);
  const lastRotatedAtIso = readOptionalIsoString(
    record,
    'lastRotatedAtIso',
    CredentialGrantParseError,
  );
  const revokedAtIso = readOptionalIsoString(record, 'revokedAtIso', CredentialGrantParseError);

  if (revokedAtIso !== undefined) {
    const revokedAt = parseIsoDate(revokedAtIso, 'revokedAtIso', CredentialGrantParseError);
    if (revokedAt < issuedAt) {
      throw new CredentialGrantParseError('revokedAtIso must not precede issuedAtIso.');
    }
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

export type CredentialGrantStatus = 'Active' | 'Expired' | 'Revoked' | 'PendingRotation';

export function deriveCredentialGrantStatus(
  grant: CredentialGrantV1,
  now: Date,
): CredentialGrantStatus {
  if (grant.revokedAtIso !== undefined) return 'Revoked';
  const expiresAt = grant.expiresAtIso === undefined ? undefined : new Date(grant.expiresAtIso);
  if (expiresAt !== undefined && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return 'Expired';
  }
  if (grant.lastRotatedAtIso !== undefined && grant.expiresAtIso !== undefined) {
    const expiresAtMs = new Date(grant.expiresAtIso).getTime();
    const nowMs = now.getTime();
    const issuedAtMs = new Date(grant.issuedAtIso).getTime();
    const remaining = expiresAtMs - nowMs;
    const total = expiresAtMs - issuedAtMs;
    if (total > 0 && remaining < total * 0.1) return 'PendingRotation';
  }
  return 'Active';
}
