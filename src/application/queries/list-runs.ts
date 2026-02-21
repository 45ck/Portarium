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
import type { RunStatus, RunV1 } from '../../domain/runs/index.js';
import {
  type AppContext,
  APP_ACTIONS,
  type Forbidden,
  type ValidationFailed,
  err,
  ok,
  type Result,
  validate,
  requiredString,
  optionalString,
  oneOf,
} from '../common/index.js';
import { paginationRules, sortRule } from '../common/query-validation.js';
import type { Page, SortClause, SortDirection } from '../common/query.js';
import type {
  AuthorizationPort,
  ListRunsQuery,
  RunFieldFilter,
  RunQueryStore,
} from '../ports/index.js';
import { RUN_SORTABLE_FIELDS } from '../ports/run-store.js';

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
  search?: string;
  sortField?: string;
  sortDirection?: string;
  limit?: number;
  cursor?: string;
}>;

export type ListRunsOutput = Readonly<Page<RunV1>>;

export type ListRunsError = Forbidden | ValidationFailed;

export interface ListRunsDeps {
  authorization: AuthorizationPort;
  runStore: RunQueryStore;
}

function parseIds(input: ListRunsInput): Result<
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
): RunFieldFilter {
  return {
    ...(input.status ? { status: input.status } : {}),
    ...(parsed.workflowId ? { workflowId: parsed.workflowId } : {}),
    ...(parsed.initiatedByUserId ? { initiatedByUserId: parsed.initiatedByUserId } : {}),
    ...(parsed.correlationId ? { correlationId: parsed.correlationId } : {}),
  };
}

function buildQuery(input: ListRunsInput, filter: RunFieldFilter): ListRunsQuery {
  const sort: SortClause | undefined = input.sortField
    ? { field: input.sortField, direction: (input.sortDirection as SortDirection) ?? 'asc' }
    : undefined;

  return {
    filter,
    pagination: {
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
    ...(sort ? { sort } : {}),
    ...(input.search ? { search: input.search } : {}),
  };
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

  const validated = validate(input, [
    requiredString('workspaceId'),
    ...paginationRules<ListRunsInput>(),
    sortRule<ListRunsInput>(RUN_SORTABLE_FIELDS),
    optionalString('workflowId'),
    optionalString('initiatedByUserId'),
    optionalString('correlationId'),
    optionalString('search'),
    ...(input.status !== undefined ? [oneOf<ListRunsInput>('status', [...RUN_STATUSES])] : []),
  ]);
  if (!validated.ok) return validated;

  const parsed = parseIds(input);
  if (!parsed.ok) return parsed;

  const filter = buildFilter(input, parsed.value);
  const query = buildQuery(input, filter);
  const page = await deps.runStore.listRuns(ctx.tenantId, parsed.value.workspaceId, query);
  return ok(page);
}
