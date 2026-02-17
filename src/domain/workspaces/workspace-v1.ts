import { WorkspaceId, type WorkspaceId as WorkspaceIdType } from '../primitives/index.js';

export type WorkspaceV1 = Readonly<{
  workspaceId: WorkspaceIdType;
  name: string;
  createdAtIso: string;
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

  return {
    workspaceId,
    name,
    createdAtIso,
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new WorkspaceParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
