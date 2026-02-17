import {
  CredentialGrantId,
  ProjectId,
  UserId,
  WorkspaceId,
  type CredentialGrantId as CredentialGrantIdType,
  type ProjectId as ProjectIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type WorkspaceV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  name: string;
  createdAtIso: string;
  userIds?: readonly UserIdType[];
  projectIds?: readonly ProjectIdType[];
  credentialGrantIds?: readonly CredentialGrantIdType[];
}>;

export class WorkspaceParseError extends Error {
  public override readonly name = 'WorkspaceParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseWorkspaceV1(value: unknown): WorkspaceV1 {
  if (!isRecord(value)) {
    throw new WorkspaceParseError('Workspace must be an object.');
  }

  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const name = readString(value, 'name');
  const createdAtIso = readString(value, 'createdAtIso');
  const userIds = parseOptionalIdArray(value, 'userIds', UserId);
  const projectIds = parseOptionalIdArray(value, 'projectIds', ProjectId);
  const credentialGrantIds = parseOptionalIdArray(value, 'credentialGrantIds', CredentialGrantId);

  return {
    workspaceId,
    name,
    createdAtIso,
    ...(userIds ? { userIds } : {}),
    ...(projectIds ? { projectIds } : {}),
    ...(credentialGrantIds ? { credentialGrantIds } : {}),
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkspaceParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function parseOptionalIdArray<T>(
  obj: Record<string, unknown>,
  key: string,
  ctor: (value: string) => T,
): readonly T[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;

  const raw = obj[key];
  if (!Array.isArray(raw)) {
    throw new WorkspaceParseError(`${key} must be an array when provided.`);
  }

  const items: T[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || item.trim() === '') {
      throw new WorkspaceParseError(`${key} must contain only non-empty strings.`);
    }
    const id = ctor(item);
    const seenKey = String(item);
    if (seen.has(seenKey)) {
      throw new WorkspaceParseError(`${key} must not contain duplicate values.`);
    }
    seen.add(seenKey);
    items.push(id);
  }

  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
