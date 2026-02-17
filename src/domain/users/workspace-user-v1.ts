import {
  UserId,
  WorkspaceId,
  isWorkspaceUserRole,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkspaceUserRole,
} from '../primitives/index.js';

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
  if (!isRecord(value)) {
    throw new WorkspaceUserParseError('User must be an object.');
  }

  const userId = UserId(readString(value, 'userId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));

  const email = readString(value, 'email');
  if (!isEmailLike(email)) {
    throw new WorkspaceUserParseError('email must be a valid email address.');
  }

  const displayName = readOptionalString(value, 'displayName');

  const rolesRaw = value['roles'];
  const roles = parseRolesV1(rolesRaw);

  const active = readBoolean(value, 'active');
  const createdAtIso = readString(value, 'createdAtIso');

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

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkspaceUserParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkspaceUserParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new WorkspaceUserParseError(`${key} must be a boolean.`);
  }
  return v;
}

function isEmailLike(value: string): boolean {
  const s = value.trim();
  const at = s.indexOf('@');
  if (at <= 0 || at >= s.length - 1) return false;
  const dot = s.lastIndexOf('.');
  return dot > at + 1 && dot < s.length - 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}
