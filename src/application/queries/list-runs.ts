import {
  CorrelationId,
  UserId,
  WorkflowId,
  WorkspaceId,
  type CorrelationId as CorrelationIdType,
  type UserId as UserIdType,
  type WorkflowId as WorkflowIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import type { RunStatus } from '../../domain/runs/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  type Forbidden,
  type ValidationFailed,
  err,
  ok,
  type Result,
} from '../common/index.js';
import type { AuthorizationPort, ListRunsFilter, RunListPage, RunQueryStore } from '../ports/index.js';

const RUN_STATUSES = [
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
  'Succeeded',
  'Failed',
  'Cancelled',
] as const;

export type ListRunsInput = Readonly<{
  workspaceId: string;
  status?: RunStatus;
  workflowId?: string;
  initiatedByUserId?: string;
  correlationId?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListRunsOutput = Readonly<RunListPage>;

export type ListRunsError = Forbidden | ValidationFailed;

export interface ListRunsDeps {
  authorization: AuthorizationPort;
  runStore: RunQueryStore;
}

function ensureNonEmptyString(
  value: string | undefined,
  field: string,
): Result<void, ValidationFailed> {
  if (value?.trim() === '') {
    return err({ kind: 'ValidationFailed', message: `${field} must be a non-empty string.` });
  }
  return ok(undefined);
}

function validateWorkspaceId(workspaceId: string): Result<void, ValidationFailed> {
  if (workspaceId.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'workspaceId must be a non-empty string.' });
  }
  return ok(undefined);
}

function validateLimit(limit: number | undefined): Result<void, ValidationFailed> {
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    return err({ kind: 'ValidationFailed', message: 'limit must be a positive integer.' });
  }
  return ok(undefined);
}

function validateCursor(cursor: string | undefined): Result<void, ValidationFailed> {
  if (cursor?.trim() === '') {
    return err({ kind: 'ValidationFailed', message: 'cursor must be a non-empty string.' });
  }
  return ok(undefined);
}

function validateStatus(status: RunStatus | undefined): Result<void, ValidationFailed> {
  if (status !== undefined && !RUN_STATUSES.includes(status)) {
    return err({ kind: 'ValidationFailed', message: 'status is invalid.' });
  }
  return ok(undefined);
}

function validateInput(input: ListRunsInput): Result<void, ValidationFailed> {
  const workspaceIdValid = validateWorkspaceId(input.workspaceId);
  if (!workspaceIdValid.ok) return workspaceIdValid;
  const limitValid = validateLimit(input.limit);
  if (!limitValid.ok) return limitValid;
  const cursorValid = validateCursor(input.cursor);
  if (!cursorValid.ok) return cursorValid;
  const statusValid = validateStatus(input.status);
  if (!statusValid.ok) return statusValid;

  for (const [field, value] of [
    ['workflowId', input.workflowId],
    ['initiatedByUserId', input.initiatedByUserId],
    ['correlationId', input.correlationId],
  ] as const) {
    const validString = ensureNonEmptyString(value, field);
    if (!validString.ok) {
      return validString;
    }
  }

  return ok(undefined);
}

function parseIds(
  input: ListRunsInput,
): Result<
  Readonly<{
    workspaceId: WorkspaceIdType;
    workflowId?: WorkflowIdType;
    initiatedByUserId?: UserIdType;
    correlationId?: CorrelationIdType;
  }>,
  ValidationFailed
> {
  try {
    return ok({
      workspaceId: WorkspaceId(input.workspaceId),
      ...(input.workflowId ? { workflowId: WorkflowId(input.workflowId) } : {}),
      ...(input.initiatedByUserId ? { initiatedByUserId: UserId(input.initiatedByUserId) } : {}),
      ...(input.correlationId ? { correlationId: CorrelationId(input.correlationId) } : {}),
    });
  } catch {
    return err({
      kind: 'ValidationFailed',
      message: 'Invalid workspaceId/workflowId/initiatedByUserId/correlationId.',
    });
  }
}

function buildFilter(
  input: ListRunsInput,
  parsed: Readonly<{
    workflowId?: WorkflowIdType;
    initiatedByUserId?: UserIdType;
    correlationId?: CorrelationIdType;
  }>,
): ListRunsFilter {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(parsed.workflowId ? { workflowId: parsed.workflowId } : {}),
    ...(parsed.initiatedByUserId ? { initiatedByUserId: parsed.initiatedByUserId } : {}),
    ...(parsed.correlationId ? { correlationId: parsed.correlationId } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };
}

function parseInput(
  input: ListRunsInput,
): Result<
  Readonly<{ workspaceId: WorkspaceIdType; filter: ListRunsFilter }>,
  ValidationFailed
> {
  const validated = validateInput(input);
  if (!validated.ok) {
    return validated;
  }

  const parsed = parseIds(input);
  if (!parsed.ok) {
    return parsed;
  }

  return ok({
    workspaceId: parsed.value.workspaceId,
    filter: buildFilter(input, parsed.value),
  });
}

export async function listRuns(
  deps: ListRunsDeps,
  ctx: AppContext,
  input: ListRunsInput,
): Promise<Result<ListRunsOutput, ListRunsError>> {
  const allowed = await deps.authorization.isAllowed(ctx, APP_ACTIONS.runRead);
  if (!allowed) {
    return err({
      kind: 'Forbidden',
      action: APP_ACTIONS.runRead,
      message: 'Caller is not permitted to list runs.',
    });
  }

  const parsed = parseInput(input);
  if (!parsed.ok) {
    return parsed;
  }

  const page = await deps.runStore.listRuns(ctx.tenantId, parsed.value.workspaceId, parsed.value.filter);
  return ok(page);
}
