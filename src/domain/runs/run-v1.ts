import {
  CorrelationId,
  RunId,
  UserId,
  WorkspaceId,
  WorkflowId,
  type CorrelationId as CorrelationIdType,
  type ExecutionTier,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkspaceId as WorkspaceIdType,
  type WorkflowId as WorkflowIdType,
} from '../primitives/index.js';

export type RunStatus =
  | 'Pending'
  | 'Running'
  | 'WaitingForApproval'
  | 'Paused'
  | 'Succeeded'
  | 'Failed'
  | 'Cancelled';

export type RunV1 = Readonly<{
  schemaVersion: 1;
  runId: RunIdType;
  workspaceId: WorkspaceIdType;
  workflowId: WorkflowIdType;
  correlationId: CorrelationIdType;
  executionTier: ExecutionTier;
  initiatedByUserId: UserIdType;
  status: RunStatus;
  createdAtIso: string;
  startedAtIso?: string;
  endedAtIso?: string;
}>;

export class RunParseError extends Error {
  public override readonly name = 'RunParseError';

  public constructor(message: string) {
    super(message);
  }
}

export function parseRunV1(value: unknown): RunV1 {
  if (!isRecord(value)) throw new RunParseError('Run must be an object.');

  const schemaVersion = readNumber(value, 'schemaVersion');
  if (schemaVersion !== 1) throw new RunParseError(`Unsupported schemaVersion: ${schemaVersion}`);

  const runId = RunId(readString(value, 'runId'));
  const workspaceId = WorkspaceId(readString(value, 'workspaceId'));
  const workflowId = WorkflowId(readString(value, 'workflowId'));
  const correlationId = CorrelationId(readString(value, 'correlationId'));

  const executionTierRaw = readString(value, 'executionTier');
  if (!isExecutionTier(executionTierRaw)) {
    throw new RunParseError(
      'executionTier must be one of: Auto, Assisted, HumanApprove, ManualOnly.',
    );
  }

  const initiatedByUserId = UserId(readString(value, 'initiatedByUserId'));

  const statusRaw = readString(value, 'status');
  if (!isRunStatus(statusRaw)) {
    throw new RunParseError(
      'status must be one of: Pending, Running, WaitingForApproval, Paused, Succeeded, Failed, Cancelled.',
    );
  }

  const createdAtIso = readString(value, 'createdAtIso');
  parseIsoString(createdAtIso, 'createdAtIso');
  const startedAtIso = readOptionalString(value, 'startedAtIso');
  if (startedAtIso !== undefined) parseIsoString(startedAtIso, 'startedAtIso');
  const endedAtIso = readOptionalString(value, 'endedAtIso');
  if (endedAtIso !== undefined) parseIsoString(endedAtIso, 'endedAtIso');

  return {
    schemaVersion: 1,
    runId,
    workspaceId,
    workflowId,
    correlationId,
    executionTier: executionTierRaw,
    initiatedByUserId,
    status: statusRaw,
    createdAtIso,
    ...(startedAtIso ? { startedAtIso } : {}),
    ...(endedAtIso ? { endedAtIso } : {}),
  };
}

function isExecutionTier(value: string): value is ExecutionTier {
  return (
    value === 'Auto' || value === 'Assisted' || value === 'HumanApprove' || value === 'ManualOnly'
  );
}

function isRunStatus(value: string): value is RunStatus {
  return (
    value === 'Pending' ||
    value === 'Running' ||
    value === 'WaitingForApproval' ||
    value === 'Paused' ||
    value === 'Succeeded' ||
    value === 'Failed' ||
    value === 'Cancelled'
  );
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new RunParseError(`${key} must be a non-empty string.`);
  }
  return v;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new RunParseError(`${key} must be a non-empty string when provided.`);
  }
  return v;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new RunParseError(`${key} must be an integer.`);
  }
  return v;
}

function parseIsoString(value: string, label: string): void {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RunParseError(`${label} must be a valid ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
