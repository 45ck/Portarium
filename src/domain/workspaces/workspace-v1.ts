import {
  CredentialGrantId,
  ProjectId,
  TenantId,
  UserId,
  WorkspaceId,
  type CredentialGrantId as CredentialGrantIdType,
  type ProjectId as ProjectIdType,
  type TenantId as TenantIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

export type WorkspaceV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  tenantId: TenantIdType;
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
  const record = readRecord(value, 'Workspace', WorkspaceParseError);

  const workspaceId = WorkspaceId(readString(record, 'workspaceId', WorkspaceParseError));
  const tenantId = TenantId(readString(record, 'tenantId', WorkspaceParseError));
  const name = readString(record, 'name', WorkspaceParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', WorkspaceParseError);
  const userIds = parseOptionalIdArray(record, 'userIds', UserId);
  const projectIds = parseOptionalIdArray(record, 'projectIds', ProjectId);
  const credentialGrantIds = parseOptionalIdArray(record, 'credentialGrantIds', CredentialGrantId);

  return {
    workspaceId,
    tenantId,
    name,
    createdAtIso,
    ...(userIds ? { userIds } : {}),
    ...(projectIds ? { projectIds } : {}),
    ...(credentialGrantIds ? { credentialGrantIds } : {}),
  };
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

