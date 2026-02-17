import {
  ProjectId,
  WorkspaceId,
  type ProjectId as ProjectIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';

export type ProjectV1 = Readonly<{
  schemaVersion: 1;
  projectId: ProjectIdType;
  workspaceId: WorkspaceIdType;
  name: string;
  description?: string;
  createdAtIso: string;
}>;

export class ProjectParseError extends Error {
  public override readonly name = 'ProjectParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseProjectV1(value: unknown): ProjectV1 {
  if (!isRecord(value)) {
    throw new ProjectParseError('Project must be an object.');
  }

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) {
    throw new ProjectParseError('schemaVersion must be 1.');
  }

  const projectId = ProjectId(readString(value, 'projectId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const name = readString(value, 'name');
  const description = readOptionalString(value, 'description');
  const createdAtIso = readString(value, 'createdAtIso');

  return {
    schemaVersion: 1,
    projectId,
    workspaceId,
    name,
    ...(description !== undefined ? { description } : {}),
    createdAtIso,
  };
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ProjectParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return undefined;

  const v = obj[key];
  if (typeof v !== 'string') {
    throw new ProjectParseError(`${key} must be a string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ProjectParseError(`${key} must be a finite number.`);
  }
  return v;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
