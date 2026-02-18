import {
  UserId,
  WorkspaceId,
  isWorkspaceUserRole,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkspaceUserRole,
} from '../primitives/index.js';
import {
  readBoolean,
  readIsoString,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type WorkspaceUserV1 = Readonly<{
  userId: UserIdType;
  workspaceId: WorkspaceIdType;
  email: string;
  displayName?: string;
  roles: readonly WorkspaceUserRole[];
  active: boolean;
  createdAtIso: string;
}>;

export class WorkspaceUserParseError extends Error {
  public override readonly name = 'WorkspaceUserParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkspaceUserV1(value: unknown): WorkspaceUserV1 {
  const record = readRecord(value, 'User', WorkspaceUserParseError);

  const userId = UserId(readString(record, 'userId', WorkspaceUserParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', WorkspaceUserParseError));

  const email = readString(record, 'email', WorkspaceUserParseError);
  if (!isEmailLike(email)) {
    throw new WorkspaceUserParseError('email must be a valid email address.');
  }

  const displayName = readOptionalString(record, 'displayName', WorkspaceUserParseError);

  const rolesRaw = record['roles'];
  const roles = parseRolesV1(rolesRaw);

  const active = readBoolean(record, 'active', WorkspaceUserParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', WorkspaceUserParseError);

  return {
    userId,
    workspaceId,
    email,
    roles,
    active,
    createdAtIso,
    ...(displayName ? { displayName } : {}),
  };
}

function parseRolesV1(value: unknown): readonly WorkspaceUserRole[] {
  if (!isNonEmptyArray(value)) {
    throw new WorkspaceUserParseError('roles must be a non-empty array.');
  }

  const seen = new Set<string>();
  const out: WorkspaceUserRole[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const raw = value[i];
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new WorkspaceUserParseError(`roles[${i}] must be a non-empty string.`);
    }
    if (!isWorkspaceUserRole(raw)) {
      throw new WorkspaceUserParseError(
        `roles[${i}] must be one of: admin, operator, approver, auditor.`,
      );
    }
    if (seen.has(raw)) {
      throw new WorkspaceUserParseError(`roles[${i}] duplicates are not allowed.`);
    }
    seen.add(raw);
    out.push(raw);
  }

  return out;
}

function isEmailLike(value: string): boolean {
  const s = value.trim();
  const at = s.indexOf('@');
  if (at <= 0 || at >= s.length - 1) return false;
  const dot = s.lastIndexOf('.');
  return dot > at + 1 && dot < s.length - 1;
}

function isNonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}
