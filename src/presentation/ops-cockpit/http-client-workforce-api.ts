import {
  buildListHumanTasksQuery,
  buildListWorkforceMembersQuery,
  buildListWorkforceQueuesQuery,
  normalizeResourceId,
  normalizeWorkspaceId,
} from './http-client-helpers.js';
import type {
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  CursorPage,
  EscalateHumanTaskRequest,
  HumanTaskSummary,
  ListHumanTasksRequest,
  ListWorkforceMembersRequest,
  ListWorkforceQueuesRequest,
  PatchWorkforceAvailabilityRequest,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
} from './types.js';

type RequestFn = <T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  options?: Readonly<{ query?: URLSearchParams; body?: unknown; idempotencyKey?: string }>,
) => Promise<T>;

export function listWorkforceMembersApi(
  request: RequestFn,
  workspaceId: string,
  params: ListWorkforceMembersRequest = {},
): Promise<CursorPage<WorkforceMemberSummary>> {
  const query = buildListWorkforceMembersQuery(params);
  return request<CursorPage<WorkforceMemberSummary>>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce`,
    'GET',
    { query },
  );
}

export function getWorkforceMemberApi(
  request: RequestFn,
  workspaceId: string,
  workforceMemberId: string,
): Promise<WorkforceMemberSummary> {
  return request<WorkforceMemberSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/${normalizeResourceId(workforceMemberId)}`,
    'GET',
  );
}

export function patchWorkforceMemberAvailabilityApi(
  request: RequestFn,
  workspaceId: string,
  workforceMemberId: string,
  body: PatchWorkforceAvailabilityRequest,
): Promise<WorkforceMemberSummary> {
  return request<WorkforceMemberSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/${normalizeResourceId(workforceMemberId)}/availability`,
    'PATCH',
    { body },
  );
}

export function listWorkforceQueuesApi(
  request: RequestFn,
  workspaceId: string,
  params: ListWorkforceQueuesRequest = {},
): Promise<CursorPage<WorkforceQueueSummary>> {
  const query = buildListWorkforceQueuesQuery(params);
  return request<CursorPage<WorkforceQueueSummary>>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/queues`,
    'GET',
    { query },
  );
}

export function getWorkforceQueueApi(
  request: RequestFn,
  workspaceId: string,
  workforceQueueId: string,
): Promise<WorkforceQueueSummary> {
  return request<WorkforceQueueSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/queues/${normalizeResourceId(workforceQueueId)}`,
    'GET',
  );
}

export function listHumanTasksApi(
  request: RequestFn,
  workspaceId: string,
  params: ListHumanTasksRequest = {},
): Promise<CursorPage<HumanTaskSummary>> {
  const query = buildListHumanTasksQuery(params);
  return request<CursorPage<HumanTaskSummary>>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks`,
    'GET',
    { query },
  );
}

export function getHumanTaskApi(
  request: RequestFn,
  workspaceId: string,
  humanTaskId: string,
): Promise<HumanTaskSummary> {
  return request<HumanTaskSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}`,
    'GET',
  );
}

export function assignHumanTaskApi(
  request: RequestFn,
  workspaceId: string,
  humanTaskId: string,
  body: AssignHumanTaskRequest,
  idempotencyKey?: string,
): Promise<HumanTaskSummary> {
  return request<HumanTaskSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/assign`,
    'POST',
    { body, ...(idempotencyKey ? { idempotencyKey } : {}) },
  );
}

export function completeHumanTaskApi(
  request: RequestFn,
  workspaceId: string,
  humanTaskId: string,
  body: CompleteHumanTaskRequest,
  idempotencyKey?: string,
): Promise<HumanTaskSummary> {
  return request<HumanTaskSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/complete`,
    'POST',
    { body, ...(idempotencyKey ? { idempotencyKey } : {}) },
  );
}

export function escalateHumanTaskApi(
  request: RequestFn,
  workspaceId: string,
  humanTaskId: string,
  body: EscalateHumanTaskRequest,
  idempotencyKey?: string,
): Promise<HumanTaskSummary> {
  return request<HumanTaskSummary>(
    `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/escalate`,
    'POST',
    { body, ...(idempotencyKey ? { idempotencyKey } : {}) },
  );
}
