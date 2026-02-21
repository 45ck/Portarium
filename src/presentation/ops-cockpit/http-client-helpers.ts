import { buildCursorQuery } from './pagination.js';
import type {
  CursorPaginationRequest,
  ListEvidenceRequest,
  ListHumanTasksRequest,
  ListRunsRequest,
  ListWorkItemsRequest,
  ListWorkforceMembersRequest,
  ListWorkforceQueuesRequest,
} from './types.js';

export function buildListRunsQuery(request: ListRunsRequest): URLSearchParams {
  const query = buildCursorQuery(request).query;
  if (request.status) query.set('status', request.status);
  if (request.workflowId) query.set('workflowId', request.workflowId);
  if (request.initiatedByUserId) query.set('initiatedByUserId', request.initiatedByUserId);
  if (request.correlationId) query.set('correlationId', request.correlationId);
  if (request.sort) query.set('sort', request.sort);
  if (request.q) query.set('q', request.q);
  return query;
}

export function buildListWorkItemsQuery(request: ListWorkItemsRequest): URLSearchParams {
  const query = buildCursorQuery(request).query;
  if (request.status) query.set('status', request.status);
  if (request.ownerUserId) query.set('ownerUserId', request.ownerUserId);
  if (request.runId) query.set('runId', request.runId);
  if (request.workflowId) query.set('workflowId', request.workflowId);
  if (request.approvalId) query.set('approvalId', request.approvalId);
  if (request.evidenceId) query.set('evidenceId', request.evidenceId);
  return query;
}

export function buildListEvidenceQuery(request: ListEvidenceRequest): URLSearchParams {
  const query = buildCursorQuery(request).query;
  if (request.runId) query.set('runId', request.runId);
  if (request.planId) query.set('planId', request.planId);
  if (request.workItemId) query.set('workItemId', request.workItemId);
  if (request.category) query.set('category', request.category);
  return query;
}

export function buildListWorkforceMembersQuery(request: ListWorkforceMembersRequest): URLSearchParams {
  const query = buildCursorQueryParams(request);
  if (request.capability) query.set('capability', request.capability);
  if (request.queueId) query.set('queueId', request.queueId);
  if (request.availability) query.set('availability', request.availability);
  return query;
}

export function buildListWorkforceQueuesQuery(request: ListWorkforceQueuesRequest): URLSearchParams {
  const query = buildCursorQueryParams(request);
  if (request.capability) query.set('capability', request.capability);
  return query;
}

export function buildListHumanTasksQuery(request: ListHumanTasksRequest): URLSearchParams {
  const query = buildCursorQueryParams(request);
  if (request.assigneeId) query.set('assigneeId', request.assigneeId);
  if (request.status) query.set('status', request.status);
  if (request.runId) query.set('runId', request.runId);
  return query;
}

export function buildCursorQueryParams(request: CursorPaginationRequest): URLSearchParams {
  return buildCursorQuery(request).query;
}

export async function buildRequestHeaders(input: Readonly<{
  defaultHeaders: Record<string, string>;
  hasJsonBody: boolean;
  idempotencyKey?: string;
  getAuthToken?: () => string | Promise<string>;
}>): Promise<Headers> {
  const headers = new Headers(input.defaultHeaders);
  headers.set('Accept', 'application/json');
  headers.set('X-Client', 'portarium-presentation');

  if (input.hasJsonBody) headers.set('Content-Type', 'application/json');
  if (hasValue(input.idempotencyKey)) headers.set('Idempotency-Key', input.idempotencyKey);
  if (input.getAuthToken) {
    const token = await input.getAuthToken();
    if (hasValue(token)) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export function buildRequestUrl(baseUrl: string, path: string, query?: URLSearchParams): string {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, baseUrl);
  if (query) {
    query.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

export function normalizeRequestBody(body?: unknown): string | undefined {
  if (body === undefined) return undefined;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

export function safeJsonParse(input: string): unknown {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function normalizeWorkspaceId(workspaceId: string): string {
  return encodeURIComponent(workspaceId);
}

export function normalizeResourceId(resourceId: string): string {
  return encodeURIComponent(resourceId);
}

function hasValue(input: string | undefined): input is string {
  return typeof input === 'string' && input.length > 0;
}
