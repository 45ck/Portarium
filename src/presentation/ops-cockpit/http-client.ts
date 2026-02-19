import { isProblemDetails, ProblemDetailsError } from './problem-details.js';
import { buildCursorQuery } from './pagination.js';
import type {
  ApprovalDecisionRequest,
  ApprovalSummary,
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  CursorPage,
  CursorPaginationRequest,
  CreateApprovalRequest,
  CreateWorkItemCommand,
  EvidenceEntry,
  EscalateHumanTaskRequest,
  HumanTaskSummary,
  ListApprovalsRequest,
  ListEvidenceRequest,
  ListHumanTasksRequest,
  ListRunsRequest,
  ListWorkItemsRequest,
  Plan,
  PatchWorkforceAvailabilityRequest,
  RunDetail,
  RunSummary,
  StartRunCommand,
  ListWorkforceMembersRequest,
  ListWorkforceQueuesRequest,
  UpdateWorkItemCommand,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
  WorkItemSummary,
} from './types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface ControlPlaneClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  requestTimeoutMs?: number;
}

export class ControlPlaneClientError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string) {
    super(`Control Plane request failed with status ${status}.`);
    this.name = 'ControlPlaneClientError';
    this.status = status;
    this.body = body;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ParseFn<T> = (value: unknown) => T;

interface ApiRequestOptions<T = never> {
  query?: URLSearchParams;
  body?: unknown;
  idempotencyKey?: string;
  parse?: ParseFn<T>;
  signal?: AbortSignal;
}

export class ControlPlaneClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly getAuthToken: (() => string | Promise<string>) | undefined;

  constructor(config: ControlPlaneClientConfig) {
    this.baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.defaultHeaders = config.defaultHeaders ?? {};
    this.getAuthToken = config.getAuthToken;
  }

  public async listRuns(
    workspaceId: string,
    request: ListRunsRequest = {},
  ): Promise<CursorPage<RunSummary>> {
    const query = this.buildListRunsQuery(request);
    return this.request<CursorPage<RunSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs`,
      'GET',
      { query },
    );
  }

  public async getRun(workspaceId: string, runId: string): Promise<RunDetail> {
    return this.request<RunDetail>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}`,
      'GET',
    );
  }

  public async startRun(
    workspaceId: string,
    command: StartRunCommand,
    idempotencyKey?: string,
  ): Promise<RunDetail> {
    return this.request<RunDetail>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs`,
      'POST',
      { body: command, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async cancelRun(workspaceId: string, runId: string): Promise<RunDetail> {
    return this.request<RunDetail>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}/cancel`,
      'POST',
    );
  }

  public async listWorkItems(
    workspaceId: string,
    request: ListWorkItemsRequest = {},
  ): Promise<CursorPage<WorkItemSummary>> {
    const query = this.buildListWorkItemsQuery(request);
    return this.request<CursorPage<WorkItemSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items`,
      'GET',
      { query },
    );
  }

  public async createWorkItem(
    workspaceId: string,
    command: CreateWorkItemCommand,
    idempotencyKey?: string,
  ): Promise<WorkItemSummary> {
    return this.request<WorkItemSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items`,
      'POST',
      { body: command, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async getWorkItem(workspaceId: string, workItemId: string): Promise<WorkItemSummary> {
    return this.request<WorkItemSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items/${normalizeResourceId(workItemId)}`,
      'GET',
    );
  }

  public async updateWorkItem(
    workspaceId: string,
    workItemId: string,
    command: UpdateWorkItemCommand,
  ): Promise<WorkItemSummary> {
    return this.request<WorkItemSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items/${normalizeResourceId(workItemId)}`,
      'PATCH',
      { body: command },
    );
  }

  public async getPlan(workspaceId: string, planId: string): Promise<Plan> {
    return this.request<Plan>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/plans/${normalizeResourceId(planId)}`,
      'GET',
    );
  }

  public async listEvidence(
    workspaceId: string,
    request: ListEvidenceRequest = {},
  ): Promise<CursorPage<EvidenceEntry>> {
    const query = this.buildListEvidenceQuery(request);
    return this.request<CursorPage<EvidenceEntry>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/evidence`,
      'GET',
      { query },
    );
  }

  public async listRunEvidence(
    workspaceId: string,
    runId: string,
    request: CursorPaginationRequest = {},
  ): Promise<CursorPage<EvidenceEntry>> {
    const query = this.buildCursorQuery(request);
    return this.request<CursorPage<EvidenceEntry>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}/evidence`,
      'GET',
      { query },
    );
  }

  public async listApprovals(
    workspaceId: string,
    request: ListApprovalsRequest = {},
  ): Promise<CursorPage<ApprovalSummary>> {
    const query = this.buildCursorQuery(request);
    return this.request<CursorPage<ApprovalSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals`,
      'GET',
      { query },
    );
  }

  public async createApproval(
    workspaceId: string,
    request: CreateApprovalRequest,
    idempotencyKey?: string,
  ): Promise<ApprovalSummary> {
    return this.request<ApprovalSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals`,
      'POST',
      { body: request, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async getApproval(workspaceId: string, approvalId: string): Promise<ApprovalSummary> {
    return this.request<ApprovalSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals/${normalizeResourceId(approvalId)}`,
      'GET',
    );
  }

  public async decideApproval(
    workspaceId: string,
    approvalId: string,
    request: ApprovalDecisionRequest & { idempotencyKey?: string },
  ): Promise<ApprovalSummary> {
    const { idempotencyKey, ...body } = request;

    return this.request<ApprovalSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals/${normalizeResourceId(approvalId)}/decide`,
      'POST',
      { body, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async listWorkforceMembers(
    workspaceId: string,
    request: ListWorkforceMembersRequest = {},
  ): Promise<CursorPage<WorkforceMemberSummary>> {
    const query = this.buildListWorkforceMembersQuery(request);
    return this.request<CursorPage<WorkforceMemberSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce`,
      'GET',
      { query },
    );
  }

  public async getWorkforceMember(
    workspaceId: string,
    workforceMemberId: string,
  ): Promise<WorkforceMemberSummary> {
    return this.request<WorkforceMemberSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/${normalizeResourceId(workforceMemberId)}`,
      'GET',
    );
  }

  public async patchWorkforceMemberAvailability(
    workspaceId: string,
    workforceMemberId: string,
    request: PatchWorkforceAvailabilityRequest,
  ): Promise<WorkforceMemberSummary> {
    return this.request<WorkforceMemberSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/${normalizeResourceId(workforceMemberId)}/availability`,
      'PATCH',
      { body: request },
    );
  }

  public async listWorkforceQueues(
    workspaceId: string,
    request: ListWorkforceQueuesRequest = {},
  ): Promise<CursorPage<WorkforceQueueSummary>> {
    const query = this.buildListWorkforceQueuesQuery(request);
    return this.request<CursorPage<WorkforceQueueSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/workforce/queues`,
      'GET',
      { query },
    );
  }

  public async listHumanTasks(
    workspaceId: string,
    request: ListHumanTasksRequest = {},
  ): Promise<CursorPage<HumanTaskSummary>> {
    const query = this.buildListHumanTasksQuery(request);
    return this.request<CursorPage<HumanTaskSummary>>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks`,
      'GET',
      { query },
    );
  }

  public async getHumanTask(workspaceId: string, humanTaskId: string): Promise<HumanTaskSummary> {
    return this.request<HumanTaskSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}`,
      'GET',
    );
  }

  public async assignHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: AssignHumanTaskRequest,
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return this.request<HumanTaskSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/assign`,
      'POST',
      { body: request, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async completeHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: CompleteHumanTaskRequest = {},
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return this.request<HumanTaskSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/complete`,
      'POST',
      { body: request, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public async escalateHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: EscalateHumanTaskRequest,
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return this.request<HumanTaskSummary>(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/human-tasks/${normalizeResourceId(humanTaskId)}/escalate`,
      'POST',
      { body: request, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  private buildListRunsQuery(request: ListRunsRequest): URLSearchParams {
    return this.buildCursorQuery(request);
  }

  private buildListWorkItemsQuery(request: ListWorkItemsRequest): URLSearchParams {
    const query = buildCursorQuery(request).query;
    if (request.status) {
      query.set('status', request.status);
    }
    if (request.ownerUserId) {
      query.set('ownerUserId', request.ownerUserId);
    }
    if (request.runId) {
      query.set('runId', request.runId);
    }
    if (request.workflowId) {
      query.set('workflowId', request.workflowId);
    }
    if (request.approvalId) {
      query.set('approvalId', request.approvalId);
    }
    if (request.evidenceId) {
      query.set('evidenceId', request.evidenceId);
    }
    return query;
  }

  private buildListEvidenceQuery(request: ListEvidenceRequest): URLSearchParams {
    const query = buildCursorQuery(request).query;
    if (request.runId) {
      query.set('runId', request.runId);
    }
    if (request.planId) {
      query.set('planId', request.planId);
    }
    if (request.workItemId) {
      query.set('workItemId', request.workItemId);
    }
    if (request.category) {
      query.set('category', request.category);
    }
    return query;
  }

  private buildListWorkforceMembersQuery(request: ListWorkforceMembersRequest): URLSearchParams {
    const query = this.buildCursorQuery(request);
    if (request.capability) {
      query.set('capability', request.capability);
    }
    if (request.queueId) {
      query.set('queueId', request.queueId);
    }
    if (request.availability) {
      query.set('availability', request.availability);
    }
    return query;
  }

  private buildListWorkforceQueuesQuery(request: ListWorkforceQueuesRequest): URLSearchParams {
    const query = this.buildCursorQuery(request);
    if (request.capability) {
      query.set('capability', request.capability);
    }
    return query;
  }

  private buildListHumanTasksQuery(request: ListHumanTasksRequest): URLSearchParams {
    const query = this.buildCursorQuery(request);
    if (request.assigneeId) {
      query.set('assigneeId', request.assigneeId);
    }
    if (request.status) {
      query.set('status', request.status);
    }
    if (request.runId) {
      query.set('runId', request.runId);
    }
    return query;
  }

  protected buildCursorQuery(request: CursorPaginationRequest): URLSearchParams {
    return buildCursorQuery(request).query;
  }

  protected async request<T>(
    path: string,
    method: HttpMethod,
    options: ApiRequestOptions<T> = {},
  ): Promise<T> {
    const headers = await this.buildHeaders(Boolean(options.body), options.idempotencyKey);
    const url = this.buildUrl(path, options.query);
    const body = this.normalizeBody(options.body);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      const requestInit: RequestInit = {
        method,
        headers,
        signal: options.signal ?? controller.signal,
      };
      if (body !== undefined) {
        requestInit.body = body;
      }
      const response = await this.fetchImpl(url, requestInit);

      if (!response.ok) {
        await this.throwResponseError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const responseText = await response.text();
      if (!responseText) {
        return undefined as T;
      }

      const parsed = safeJsonParse(responseText);
      if (!parsed) {
        throw new ControlPlaneClientError(response.status, 'Invalid JSON response');
      }

      const parse = options.parse ?? ((value: unknown): T => value as T);
      return parse(parsed);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async throwResponseError(response: Response): Promise<never> {
    const bodyText = await response.text();
    const parsed = safeJsonParse(bodyText);
    if (parsed && isProblemDetails(parsed)) {
      throw new ProblemDetailsError(parsed);
    }
    throw new ControlPlaneClientError(response.status, bodyText);
  }

  private async buildHeaders(hasJsonBody: boolean, idempotencyKey?: string): Promise<Headers> {
    const headers = new Headers(this.defaultHeaders);
    headers.set('Accept', 'application/json');
    headers.set('X-Client', 'portarium-presentation');

    if (hasJsonBody) {
      headers.set('Content-Type', 'application/json');
    }
    if (hasValue(idempotencyKey)) {
      headers.set('Idempotency-Key', idempotencyKey);
    }
    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (hasValue(token)) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  private buildUrl(path: string, query?: URLSearchParams): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(normalizedPath, this.baseUrl);
    if (query) {
      query.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }
    return url.toString();
  }

  private normalizeBody(body?: unknown): string | undefined {
    if (body === undefined) return undefined;
    if (typeof body === 'string') return body;
    return JSON.stringify(body);
  }
}

function safeJsonParse(input: string): unknown {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function normalizeWorkspaceId(workspaceId: string): string {
  return encodeURIComponent(workspaceId);
}

function normalizeResourceId(resourceId: string): string {
  return encodeURIComponent(resourceId);
}

function hasValue(input: string | undefined): input is string {
  return typeof input === 'string' && input.length > 0;
}
