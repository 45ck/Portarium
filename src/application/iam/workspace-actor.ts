import {
  UserId,
  WorkspaceId,
  isWorkspaceUserRole,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkspaceUserRole,
} from '../../domain/primitives/index.js';

export type WorkspaceActor = Readonly<{
  userId: UserIdType;
  workspaceId: WorkspaceIdType;
  roles: readonly WorkspaceUserRole[];
}>;

export class WorkspaceAuthClaimParseError extends Error {
  public override readonly name = 'WorkspaceAuthClaimParseError';
}

type ClaimRecord = Readonly<Record<string, unknown>>;

function readRecord(value: unknown): ClaimRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkspaceAuthClaimParseError('Token claims must be an object.');
  }
  return value as ClaimRecord;
}

function readNonEmptyString(record: ClaimRecord, key: string): string {
  const raw = record[key];
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new WorkspaceAuthClaimParseError(`${key} must be a non-empty string.`);
  }
  return raw;
}

function readRoles(record: ClaimRecord, key: string): readonly WorkspaceUserRole[] {
  const raw = record[key];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new WorkspaceAuthClaimParseError(`${key} must be a non-empty array.`);
  }

  const items = raw as readonly unknown[];
  const seen = new Set<string>();
  const out: WorkspaceUserRole[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const entry = items[i];
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new WorkspaceAuthClaimParseError(`${key}[${i}] must be a non-empty string.`);
    }
    if (!isWorkspaceUserRole(entry)) {
      throw new WorkspaceAuthClaimParseError(
        `${key}[${i}] must be one of: admin, operator, approver, auditor.`,
      );
    }
    if (seen.has(entry)) {
      throw new WorkspaceAuthClaimParseError(`${key}[${i}] duplicates are not allowed.`);
    }
    seen.add(entry);
    out.push(entry);
  }

  return out;
}

/**
 * Parse trusted authentication claims into a workspace-scoped actor.
 *
 * Required claims (v1):
 * - sub: UserId string
 * - workspaceId: WorkspaceId string (alias for TenantId in v1)
 * - roles: non-empty WorkspaceUserRole[] with no duplicates
 */
export function parseWorkspaceActorFromClaims(claims: unknown): WorkspaceActor {
  const record = readRecord(claims);

  const sub = readNonEmptyString(record, 'sub');
  const workspaceId = readNonEmptyString(record, 'workspaceId');
  const roles = readRoles(record, 'roles');

  try {
    return {
      userId: UserId(sub),
      workspaceId: WorkspaceId(workspaceId),
      roles,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Token claims contain invalid identifiers.';
    throw new WorkspaceAuthClaimParseError(message);
  }
}
