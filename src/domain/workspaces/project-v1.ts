import {
  ProjectId,
  WorkspaceId,
  type ProjectId as ProjectIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../primitives/index.js';
import {
  readIsoString,
  readInteger,
  readOptionalString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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
  const record = readRecord(value, 'Project', ProjectParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', ProjectParseError);
  if (schemaVersion !== 1) {
    throw new ProjectParseError('schemaVersion must be 1.');
  }

  const projectId = ProjectId(readString(record, 'projectId', ProjectParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', ProjectParseError));
  const name = readString(record, 'name', ProjectParseError);
  const description = readOptionalString(record, 'description', ProjectParseError);
  const createdAtIso = readIsoString(record, 'createdAtIso', ProjectParseError);

  return {
    schemaVersion: 1,
    projectId,
    workspaceId,
    name,
    ...(description !== undefined ? { description } : {}),
    createdAtIso,
  };
}
