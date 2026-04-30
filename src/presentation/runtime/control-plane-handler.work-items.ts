import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { APP_ACTIONS } from '../../application/common/actions.js';
import { getWorkItem } from '../../application/queries/get-work-item.js';
import { listWorkItems } from '../../application/queries/list-work-items.js';
import {
  UserId,
  TenantId,
  WorkforceMemberId,
  WorkItemId,
  WorkspaceId,
} from '../../domain/primitives/index.js';
import {
  parseWorkItemV1,
  type WorkItemLinksV1,
  type WorkItemSlaV1,
  type WorkItemStatus,
  type WorkItemV1,
} from '../../domain/work-items/index.js';
import type { TraceContext } from '../../application/common/trace-context.js';
import {
  authenticate,
  checkIfMatch,
  computeETag,
  hasRole,
  problemFromError,
  readJsonBody,
  respondJson,
  respondProblem,
  type ControlPlaneDeps,
  type ProblemDetails,
} from './control-plane-handler.shared.js';

type WorkItemArgs = Readonly<{
  deps: ControlPlaneDeps;
  req: IncomingMessage;
  res: ServerResponse;
  correlationId: string;
  pathname: string;
  workspaceId: string;
  traceContext: TraceContext;
}>;

type WorkItemByIdArgs = WorkItemArgs & Readonly<{ workItemId: string }>;

type ParseResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; message: string }>;

type CreateWorkItemBody = Readonly<{
  title: string;
  ownerUserId?: string;
  sla?: WorkItemSlaV1;
  externalRefs?: readonly unknown[];
}>;

type UpdateWorkItemBody = Readonly<{
  title?: string;
  status?: WorkItemStatus;
  ownerUserId?: string;
  sla?: WorkItemSlaV1;
  externalRefs?: readonly unknown[];
}>;

const WORK_ITEM_STATUSES = new Set(['Open', 'InProgress', 'Blocked', 'Resolved', 'Closed']);
const CREATE_WORK_ITEM_FIELDS = new Set(['title', 'ownerUserId', 'sla', 'externalRefs']);
const UPDATE_WORK_ITEM_FIELDS = new Set(['title', 'status', 'ownerUserId', 'sla', 'externalRefs']);
const ASSIGNMENT_FIELDS = new Set(['workforceMemberId']);

function serviceUnavailable(pathname: string, detail: string): ProblemDetails {
  return {
    type: 'https://portarium.dev/problems/service-unavailable',
    title: 'Service Unavailable',
    status: 503,
    detail,
    instance: pathname,
  };
}

function badBodyProblem(
  pathname: string,
  error: 'empty-body' | 'invalid-json' | 'unsupported-content-type',
) {
  return {
    type:
      error === 'unsupported-content-type'
        ? 'https://portarium.dev/problems/unsupported-media-type'
        : 'https://portarium.dev/problems/bad-request',
    title: error === 'unsupported-content-type' ? 'Unsupported Media Type' : 'Bad Request',
    status: error === 'unsupported-content-type' ? 415 : 400,
    detail:
      error === 'invalid-json'
        ? 'Request body contains invalid JSON.'
        : error === 'empty-body'
          ? 'Request body must not be empty.'
          : 'Content-Type must be application/json.',
    instance: pathname,
  };
}

function validationProblem(pathname: string, detail: string): ProblemDetails {
  return {
    type: 'https://portarium.dev/problems/validation-failed',
    title: 'Validation Failed',
    status: 422,
    detail,
    instance: pathname,
  };
}

async function authenticateWorkspace(args: WorkItemArgs | WorkItemByIdArgs) {
  const auth = await authenticate(args.deps, {
    req: args.req,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    expectedWorkspaceId: args.workspaceId,
  });
  if (!auth.ok) {
    respondProblem(
      args.res,
      problemFromError(auth.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  if (String(auth.ctx.tenantId) !== args.workspaceId) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: `Token workspace does not match requested workspace: ${args.workspaceId}`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  return auth;
}

async function authorizeWorkItemMutation(args: WorkItemArgs | WorkItemByIdArgs) {
  const auth = await authenticateWorkspace(args);
  if (!auth) return undefined;
  if (!hasRole(auth.ctx, 'admin') && !hasRole(auth.ctx, 'operator')) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Only admin/operator can mutate work items.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  const allowed = await args.deps.authorization.isAllowed(auth.ctx, APP_ACTIONS.workforceAssign);
  if (!allowed) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Caller is not permitted to mutate work items.',
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  return auth;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validateKnownFields(
  record: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  label: string,
): ParseResult<void> {
  const unknown = Object.keys(record).filter((field) => !allowedFields.has(field));
  if (unknown.length > 0) {
    return { ok: false, message: `${label} contains unsupported field(s): ${unknown.join(', ')}.` };
  }
  return { ok: true, value: undefined };
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string,
): ParseResult<string | undefined> {
  const value = record[field];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string' && value.trim() !== '') return { ok: true, value };
  return { ok: false, message: `${field} must be a non-empty string.` };
}

function readOptionalSla(record: Record<string, unknown>): ParseResult<WorkItemSlaV1 | undefined> {
  const value = record['sla'];
  if (value === undefined) return { ok: true, value: undefined };
  const sla = asRecord(value);
  if (!sla) return { ok: false, message: 'sla must be an object.' };
  const dueAtIso = sla['dueAtIso'];
  if (dueAtIso === undefined) return { ok: true, value: {} };
  if (typeof dueAtIso !== 'string' || Number.isNaN(Date.parse(dueAtIso))) {
    return { ok: false, message: 'sla.dueAtIso must be an ISO timestamp.' };
  }
  return { ok: true, value: { dueAtIso } };
}

function readOptionalExternalRefs(
  record: Record<string, unknown>,
): ParseResult<readonly unknown[] | undefined> {
  const value = record['externalRefs'];
  if (value === undefined) return { ok: true, value: undefined };
  if (!Array.isArray(value)) return { ok: false, message: 'externalRefs must be an array.' };
  return { ok: true, value };
}

function parseCreateBody(value: unknown): ParseResult<CreateWorkItemBody> {
  const record = asRecord(value);
  if (!record) return { ok: false, message: 'Request body must be a JSON object.' };
  const fields = validateKnownFields(record, CREATE_WORK_ITEM_FIELDS, 'CreateWorkItemRequest');
  if (!fields.ok) return fields;
  const title = record['title'];
  if (typeof title !== 'string' || title.trim() === '') {
    return { ok: false, message: 'title must be a non-empty string.' };
  }
  const ownerUserId = readOptionalString(record, 'ownerUserId');
  if (!ownerUserId.ok) return ownerUserId;
  const sla = readOptionalSla(record);
  if (!sla.ok) return sla;
  const externalRefs = readOptionalExternalRefs(record);
  if (!externalRefs.ok) return externalRefs;
  return {
    ok: true,
    value: {
      title,
      ...(ownerUserId.value ? { ownerUserId: ownerUserId.value } : {}),
      ...(sla.value ? { sla: sla.value } : {}),
      ...(externalRefs.value ? { externalRefs: externalRefs.value } : {}),
    },
  };
}

function parseUpdateBody(value: unknown): ParseResult<UpdateWorkItemBody> {
  const record = asRecord(value);
  if (!record) return { ok: false, message: 'Request body must be a JSON object.' };
  const fields = validateKnownFields(record, UPDATE_WORK_ITEM_FIELDS, 'UpdateWorkItemRequest');
  if (!fields.ok) return fields;
  if (Object.keys(record).length === 0) {
    return { ok: false, message: 'At least one work item field must be provided.' };
  }
  const title = readOptionalString(record, 'title');
  if (!title.ok) return title;
  const ownerUserId = readOptionalString(record, 'ownerUserId');
  if (!ownerUserId.ok) return ownerUserId;
  const status = record['status'];
  if (status !== undefined && (typeof status !== 'string' || !WORK_ITEM_STATUSES.has(status))) {
    return { ok: false, message: 'status is invalid.' };
  }
  const sla = readOptionalSla(record);
  if (!sla.ok) return sla;
  const externalRefs = readOptionalExternalRefs(record);
  if (!externalRefs.ok) return externalRefs;
  return {
    ok: true,
    value: {
      ...(title.value ? { title: title.value } : {}),
      ...(typeof status === 'string' ? { status: status as WorkItemStatus } : {}),
      ...(ownerUserId.value ? { ownerUserId: ownerUserId.value } : {}),
      ...(sla.value ? { sla: sla.value } : {}),
      ...(externalRefs.value ? { externalRefs: externalRefs.value } : {}),
    },
  };
}

function withExternalRefs(
  current: WorkItemLinksV1 | undefined,
  externalRefs: readonly unknown[] | undefined,
): WorkItemLinksV1 | undefined {
  if (externalRefs === undefined) return current;
  const parsedExternalRefs = externalRefs as NonNullable<WorkItemLinksV1['externalRefs']>;
  return {
    ...(current ?? {}),
    externalRefs: parsedExternalRefs,
  };
}

async function readBody(args: WorkItemArgs | WorkItemByIdArgs): Promise<unknown | undefined> {
  const bodyResult = await readJsonBody(args.req);
  if (bodyResult.ok) return bodyResult.value;
  respondProblem(
    args.res,
    badBodyProblem(args.pathname, bodyResult.error),
    args.correlationId,
    args.traceContext,
  );
  return undefined;
}

async function loadWorkItem(
  args: WorkItemByIdArgs,
  tenantId: string,
): Promise<WorkItemV1 | undefined> {
  if (!args.deps.workItemStore) {
    respondProblem(
      args.res,
      serviceUnavailable(args.pathname, 'Work item store is not configured.'),
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  const workItem = await args.deps.workItemStore.getWorkItemById(
    TenantId(tenantId),
    WorkspaceId(args.workspaceId),
    WorkItemId(args.workItemId),
  );
  if (workItem === null) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `WorkItem ${args.workItemId} not found.`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return undefined;
  }
  return workItem;
}

export async function handleListWorkItems(args: WorkItemArgs): Promise<void> {
  const auth = await authenticateWorkspace(args);
  if (!auth) return;
  if (!args.deps.workItemStore) {
    respondProblem(
      args.res,
      serviceUnavailable(args.pathname, 'Work item store is not configured.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }

  const url = new URL(args.req.url ?? '/', 'http://localhost');
  const result = await listWorkItems(
    { authorization: args.deps.authorization, workItemStore: args.deps.workItemStore },
    auth.ctx,
    {
      workspaceId: args.workspaceId,
      ...(url.searchParams.get('status')
        ? { status: url.searchParams.get('status') as WorkItemStatus }
        : {}),
      ...(url.searchParams.get('ownerUserId')
        ? { ownerUserId: url.searchParams.get('ownerUserId')! }
        : {}),
      ...(url.searchParams.get('runId') ? { runId: url.searchParams.get('runId')! } : {}),
      ...(url.searchParams.get('workflowId')
        ? { workflowId: url.searchParams.get('workflowId')! }
        : {}),
      ...(url.searchParams.get('approvalId')
        ? { approvalId: url.searchParams.get('approvalId')! }
        : {}),
      ...(url.searchParams.get('evidenceId')
        ? { evidenceId: url.searchParams.get('evidenceId')! }
        : {}),
      ...(url.searchParams.get('limit')
        ? { limit: Number.parseInt(url.searchParams.get('limit')!, 10) }
        : {}),
      ...(url.searchParams.get('cursor') ? { cursor: url.searchParams.get('cursor')! } : {}),
    },
  );
  if (!result.ok) {
    respondProblem(
      args.res,
      problemFromError(result.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  args.res.setHeader('ETag', computeETag(result.value));
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: result.value,
  });
}

export async function handleCreateWorkItem(args: WorkItemArgs): Promise<void> {
  const auth = await authorizeWorkItemMutation(args);
  if (!auth) return;
  if (!args.deps.workItemStore) {
    respondProblem(
      args.res,
      serviceUnavailable(args.pathname, 'Work item store is not configured.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const body = await readBody(args);
  if (body === undefined) return;
  const parsed = parseCreateBody(body);
  if (!parsed.ok) {
    respondProblem(
      args.res,
      validationProblem(args.pathname, parsed.message),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const nowIso = (args.deps.clock ?? (() => new Date()))().toISOString();
  let workItem: WorkItemV1;
  try {
    workItem = parseWorkItemV1({
      schemaVersion: 1,
      workItemId: `wi-${randomUUID()}`,
      workspaceId: args.workspaceId,
      createdAtIso: nowIso,
      createdByUserId: String(auth.ctx.principalId),
      title: parsed.value.title,
      status: 'Open',
      ...(parsed.value.ownerUserId ? { ownerUserId: parsed.value.ownerUserId } : {}),
      ...(parsed.value.sla ? { sla: parsed.value.sla } : {}),
      ...(parsed.value.externalRefs ? { links: { externalRefs: parsed.value.externalRefs } } : {}),
    });
  } catch (error) {
    respondProblem(
      args.res,
      validationProblem(
        args.pathname,
        error instanceof Error ? error.message : 'Invalid work item.',
      ),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  await args.deps.workItemStore.saveWorkItem(auth.ctx.tenantId, workItem);
  respondJson(args.res, {
    statusCode: 201,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    location: `/v1/workspaces/${args.workspaceId}/work-items/${workItem.workItemId}`,
    body: workItem,
  });
}

export async function handleGetWorkItem(args: WorkItemByIdArgs): Promise<void> {
  const auth = await authenticateWorkspace(args);
  if (!auth) return;
  if (!args.deps.workItemStore) {
    respondProblem(
      args.res,
      serviceUnavailable(args.pathname, 'Work item store is not configured.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const result = await getWorkItem(
    { authorization: args.deps.authorization, workItemStore: args.deps.workItemStore },
    auth.ctx,
    {
      workspaceId: args.workspaceId,
      workItemId: args.workItemId,
    },
  );
  if (!result.ok) {
    respondProblem(
      args.res,
      problemFromError(result.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: result.value,
  });
}

export async function handlePatchWorkItem(args: WorkItemByIdArgs): Promise<void> {
  const auth = await authorizeWorkItemMutation(args);
  if (!auth) return;
  const existing = await loadWorkItem(args, String(auth.ctx.tenantId));
  if (!existing || !args.deps.workItemStore) return;
  const precondition = checkIfMatch(args.req, computeETag(existing));
  if (!precondition.ok) {
    respondProblem(
      args.res,
      problemFromError(precondition.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const body = await readBody(args);
  if (body === undefined) return;
  const parsed = parseUpdateBody(body);
  if (!parsed.ok) {
    respondProblem(
      args.res,
      validationProblem(args.pathname, parsed.message),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  let next: WorkItemV1;
  try {
    next = parseWorkItemV1({
      ...existing,
      ...('title' in parsed.value ? { title: parsed.value.title } : {}),
      ...('status' in parsed.value ? { status: parsed.value.status } : {}),
      ...('ownerUserId' in parsed.value ? { ownerUserId: parsed.value.ownerUserId } : {}),
      ...('sla' in parsed.value ? { sla: parsed.value.sla } : {}),
      links: withExternalRefs(existing.links, parsed.value.externalRefs),
    });
  } catch (error) {
    respondProblem(
      args.res,
      validationProblem(
        args.pathname,
        error instanceof Error ? error.message : 'Invalid work item update.',
      ),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  await args.deps.workItemStore.saveWorkItem(auth.ctx.tenantId, next);
  args.res.setHeader('ETag', computeETag(next));
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: next,
  });
}

export async function handleGetWorkItemAssignment(args: WorkItemByIdArgs): Promise<void> {
  const auth = await authenticateWorkspace(args);
  if (!auth) return;
  const workItem = await loadWorkItem(args, String(auth.ctx.tenantId));
  if (!workItem) return;
  args.res.setHeader('ETag', computeETag(workItem));
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: {
      workItemId: workItem.workItemId,
      ...(workItem.ownerUserId ? { ownerUserId: workItem.ownerUserId } : {}),
    },
  });
}

export async function handlePutWorkItemAssignment(args: WorkItemByIdArgs): Promise<void> {
  const auth = await authorizeWorkItemMutation(args);
  if (!auth) return;
  const existing = await loadWorkItem(args, String(auth.ctx.tenantId));
  if (!existing || !args.deps.workItemStore) return;
  const precondition = checkIfMatch(args.req, computeETag(existing));
  if (!precondition.ok) {
    respondProblem(
      args.res,
      problemFromError(precondition.error, args.pathname),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const body = await readBody(args);
  if (body === undefined) return;
  const record = asRecord(body);
  if (!record || !Object.prototype.hasOwnProperty.call(record, 'workforceMemberId')) {
    respondProblem(
      args.res,
      validationProblem(args.pathname, 'workforceMemberId is required.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const fields = validateKnownFields(record, ASSIGNMENT_FIELDS, 'PutWorkItemAssignmentRequest');
  if (!fields.ok) {
    respondProblem(
      args.res,
      validationProblem(args.pathname, fields.message),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const workforceMemberId = record['workforceMemberId'];
  if (
    workforceMemberId !== null &&
    (typeof workforceMemberId !== 'string' || workforceMemberId.trim() === '')
  ) {
    respondProblem(
      args.res,
      validationProblem(args.pathname, 'workforceMemberId must be a non-empty string or null.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  if (workforceMemberId === null) {
    const { ownerUserId: _ownerUserId, ...withoutOwner } = existing;
    await args.deps.workItemStore.saveWorkItem(auth.ctx.tenantId, withoutOwner);
    args.res.setHeader('ETag', computeETag(withoutOwner));
    respondJson(args.res, {
      statusCode: 200,
      correlationId: args.correlationId,
      traceContext: args.traceContext,
      body: { workItemId: existing.workItemId },
    });
    return;
  }
  if (!args.deps.workforceMemberStore) {
    respondProblem(
      args.res,
      serviceUnavailable(args.pathname, 'Workforce member store is not configured.'),
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const member = await args.deps.workforceMemberStore.getWorkforceMemberById(
    auth.ctx.tenantId,
    WorkforceMemberId(workforceMemberId),
  );
  if (member === null) {
    respondProblem(
      args.res,
      {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: `WorkforceMember ${workforceMemberId} not found.`,
        instance: args.pathname,
      },
      args.correlationId,
      args.traceContext,
    );
    return;
  }
  const next = parseWorkItemV1({ ...existing, ownerUserId: UserId(String(member.linkedUserId)) });
  await args.deps.workItemStore.saveWorkItem(auth.ctx.tenantId, next);
  args.res.setHeader('ETag', computeETag(next));
  respondJson(args.res, {
    statusCode: 200,
    correlationId: args.correlationId,
    traceContext: args.traceContext,
    body: {
      workItemId: next.workItemId,
      ownerUserId: next.ownerUserId,
      workforceMemberId: member.workforceMemberId,
    },
  });
}
