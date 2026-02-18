import {
  CorrelationId,
  RunId,
  type CorrelationId as CorrelationIdType,
  type RunId as RunIdType,
  type UserId as UserIdType,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
  type ExecutionTier,
  WorkspaceId,
  WorkflowId,
  UserId,
} from '../primitives/index.js';
import {
  assertNotBefore,
  readIsoString,
  readInteger,
  readOptionalIsoString,
  readRecord,
  readString,
} from '../validation/parse-utils.js';

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

const RUN_STATUSES = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
] as const;

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;

export function parseRunV1(value: unknown): RunV1 {
  const record = readRecord(value, 'Run', RunParseError);

  const schemaVersion = readInteger(record, 'schemaVersion', RunParseError);
  if (schemaVersion !== 1) throw new RunParseError(`Unsupported schemaVersion: ${schemaVersion}`);

  const runId = RunId(readString(record, 'runId', RunParseError));
  const workspaceId = WorkspaceId(readString(record, 'workspaceId', RunParseError));
  const workflowId = WorkflowId(readString(record, 'workflowId', RunParseError));
  const correlationId = CorrelationId(readString(record, 'correlationId', RunParseError));
  const executionTier = readExecutionTier(record);
  const initiatedByUserId = UserId(readString(record, 'initiatedByUserId', RunParseError));
  const status = readStatus(record);
  const createdAtIso = readIsoString(record, 'createdAtIso', RunParseError);
  const startedAtIso = readOptionalIsoString(record, 'startedAtIso', RunParseError);
  const endedAtIso = readOptionalIsoString(record, 'endedAtIso', RunParseError);

  if (startedAtIso !== undefined) {
    assertNotBefore(createdAtIso, startedAtIso, RunParseError, {
      anchorLabel: 'createdAtIso',
      laterLabel: 'startedAtIso',
    });
  }
  if (endedAtIso !== undefined) {
    const anchor = startedAtIso ?? createdAtIso;
    const anchorLabel = startedAtIso !== undefined ? 'startedAtIso' : 'createdAtIso';
    assertNotBefore(anchor, endedAtIso, RunParseError, {
      anchorLabel,
      laterLabel: 'endedAtIso',
    });
  }

  return {
    schemaVersion: 1,
    runId,
    workspaceId,
    workflowId,
    correlationId,
    executionTier,
    initiatedByUserId,
    status,
    createdAtIso,
    ...(startedAtIso ? { startedAtIso } : {}),
    ...(endedAtIso ? { endedAtIso } : {}),
  };
}

function readStatus(record: Record<string, unknown>): RunStatus {
  const status = readString(record, 'status', RunParseError);
  if (RUN_STATUSES.includes(status as RunStatus)) return status as RunStatus;
  throw new RunParseError(
    'status must be one of: Pending, Running, WaitingForApproval, Paused, Succeeded, Failed, Cancelled.',
  );
}

function readExecutionTier(record: Record<string, unknown>): ExecutionTier {
  const executionTierRaw = readString(record, 'executionTier', RunParseError);
  if (EXECUTION_TIERS.includes(executionTierRaw as ExecutionTier)) {
    return executionTierRaw as ExecutionTier;
  }
  throw new RunParseError(
    'executionTier must be one of: Auto, Assisted, HumanApprove, ManualOnly.',
  );
}
