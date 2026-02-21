import { isProblemDetails, ProblemDetailsError } from './problem-details.js';
import { ControlPlaneClientError } from './http-client-error.js';
import {
  buildCursorQueryParams,
  buildListEvidenceQuery,
  buildListRunsQuery,
  buildListWorkItemsQuery,
  buildRequestHeaders,
  buildRequestUrl,
  normalizeRequestBody,
  normalizeResourceId,
  normalizeWorkspaceId,
  safeJsonParse,
} from './http-client-helpers.js';
import {
  assignHumanTaskApi,
  completeHumanTaskApi,
  escalateHumanTaskApi,
  getHumanTaskApi,
  getWorkforceMemberApi,
  listHumanTasksApi,
  listWorkforceMembersApi,
  listWorkforceQueuesApi,
  patchWorkforceMemberAvailabilityApi,
} from './http-client-workforce-api.js';
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
  ListWorkforceMembersRequest,
  ListWorkforceQueuesRequest,
  PatchWorkforceAvailabilityRequest,
  Plan,
  RunDetail,
  RunSummary,
  StartRunCommand,
  UpdateWorkItemCommand,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
  WorkItemSummary,
} from './types.js';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
export { ControlPlaneClientError };

export interface ControlPlaneClientConfig {
  baseUrl: string;
  getAuthToken?: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  requestTimeoutMs?: number;
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

const parseIdentity = <T>(value: unknown): T => value as T;

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

  public listRuns(
    workspaceId: string,
    request: ListRunsRequest = {},
  ): Promise<CursorPage<RunSummary>> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs`, 'GET', {
      query: buildListRunsQuery(request),
    });
  }

  public getRun(workspaceId: string, runId: string): Promise<RunDetail> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}`,
      'GET',
    );
  }

  public startRun(
    workspaceId: string,
    command: StartRunCommand,
    idempotencyKey?: string,
  ): Promise<RunDetail> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs`, 'POST', {
      body: command,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  public cancelRun(workspaceId: string, runId: string): Promise<RunDetail> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}/cancel`,
      'POST',
    );
  }

  public listWorkItems(
    workspaceId: string,
    request: ListWorkItemsRequest = {},
  ): Promise<CursorPage<WorkItemSummary>> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items`, 'GET', {
      query: buildListWorkItemsQuery(request),
    });
  }

  public createWorkItem(
    workspaceId: string,
    command: CreateWorkItemCommand,
    idempotencyKey?: string,
  ): Promise<WorkItemSummary> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items`, 'POST', {
      body: command,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  public getWorkItem(workspaceId: string, workItemId: string): Promise<WorkItemSummary> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items/${normalizeResourceId(workItemId)}`,
      'GET',
    );
  }

  public updateWorkItem(
    workspaceId: string,
    workItemId: string,
    command: UpdateWorkItemCommand,
  ): Promise<WorkItemSummary> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/work-items/${normalizeResourceId(workItemId)}`,
      'PATCH',
      { body: command },
    );
  }

  public getPlan(workspaceId: string, planId: string): Promise<Plan> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/plans/${normalizeResourceId(planId)}`,
      'GET',
    );
  }

  public listEvidence(
    workspaceId: string,
    request: ListEvidenceRequest = {},
  ): Promise<CursorPage<EvidenceEntry>> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/evidence`, 'GET', {
      query: buildListEvidenceQuery(request),
    });
  }

  public listRunEvidence(
    workspaceId: string,
    runId: string,
    request: CursorPaginationRequest = {},
  ): Promise<CursorPage<EvidenceEntry>> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/runs/${normalizeResourceId(runId)}/evidence`,
      'GET',
      { query: this.buildCursorQuery(request) },
    );
  }

  public listApprovals(
    workspaceId: string,
    request: ListApprovalsRequest = {},
  ): Promise<CursorPage<ApprovalSummary>> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals`, 'GET', {
      query: this.buildCursorQuery(request),
    });
  }

  public createApproval(
    workspaceId: string,
    request: CreateApprovalRequest,
    idempotencyKey?: string,
  ): Promise<ApprovalSummary> {
    return this.request(`/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals`, 'POST', {
      body: request,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  public getApproval(workspaceId: string, approvalId: string): Promise<ApprovalSummary> {
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals/${normalizeResourceId(approvalId)}`,
      'GET',
    );
  }

  public decideApproval(
    workspaceId: string,
    approvalId: string,
    request: ApprovalDecisionRequest & { idempotencyKey?: string },
  ): Promise<ApprovalSummary> {
    const { idempotencyKey, ...body } = request;
    return this.request(
      `/v1/workspaces/${normalizeWorkspaceId(workspaceId)}/approvals/${normalizeResourceId(approvalId)}/decide`,
      'POST',
      { body, ...(idempotencyKey ? { idempotencyKey } : {}) },
    );
  }

  public listWorkforceMembers(
    workspaceId: string,
    request: ListWorkforceMembersRequest = {},
  ): Promise<CursorPage<WorkforceMemberSummary>> {
    return listWorkforceMembersApi(this.request.bind(this), workspaceId, request);
  }

  public getWorkforceMember(
    workspaceId: string,
    workforceMemberId: string,
  ): Promise<WorkforceMemberSummary> {
    return getWorkforceMemberApi(this.request.bind(this), workspaceId, workforceMemberId);
  }

  public patchWorkforceMemberAvailability(
    workspaceId: string,
    workforceMemberId: string,
    request: PatchWorkforceAvailabilityRequest,
  ): Promise<WorkforceMemberSummary> {
    return patchWorkforceMemberAvailabilityApi(
      this.request.bind(this),
      workspaceId,
      workforceMemberId,
      request,
    );
  }

  public listWorkforceQueues(
    workspaceId: string,
    request: ListWorkforceQueuesRequest = {},
  ): Promise<CursorPage<WorkforceQueueSummary>> {
    return listWorkforceQueuesApi(this.request.bind(this), workspaceId, request);
  }

  public listHumanTasks(
    workspaceId: string,
    request: ListHumanTasksRequest = {},
  ): Promise<CursorPage<HumanTaskSummary>> {
    return listHumanTasksApi(this.request.bind(this), workspaceId, request);
  }

  public getHumanTask(workspaceId: string, humanTaskId: string): Promise<HumanTaskSummary> {
    return getHumanTaskApi(this.request.bind(this), workspaceId, humanTaskId);
  }

  public assignHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: AssignHumanTaskRequest,
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return assignHumanTaskApi(this.request.bind(this), {
      workspaceId,
      humanTaskId,
      body: request,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  public completeHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: CompleteHumanTaskRequest = {},
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return completeHumanTaskApi(this.request.bind(this), {
      workspaceId,
      humanTaskId,
      body: request,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  public escalateHumanTask(
    workspaceId: string,
    humanTaskId: string,
    request: EscalateHumanTaskRequest,
    idempotencyKey?: string,
  ): Promise<HumanTaskSummary> {
    return escalateHumanTaskApi(this.request.bind(this), {
      workspaceId,
      humanTaskId,
      body: request,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
  }

  protected buildCursorQuery(request: CursorPaginationRequest): URLSearchParams {
    return buildCursorQueryParams(request);
  }

  protected async request<T>(
    path: string,
    method: HttpMethod,
    options: ApiRequestOptions<T> = {},
  ): Promise<T> {
    const headers = await this.buildHeaders(options);
    const requestBody = normalizeRequestBody(options.body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await this.fetchImpl(
        buildRequestUrl(this.baseUrl, path, options.query),
        this.buildRequestInit(method, headers, options.signal ?? controller.signal, requestBody),
      );
      if (!response.ok) await this.throwResponseError(response);
      return this.parseResponse(response, options.parse ?? parseIdentity<T>);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async buildHeaders<T>(options: ApiRequestOptions<T>): Promise<Headers> {
    return buildRequestHeaders({
      defaultHeaders: this.defaultHeaders,
      hasJsonBody: Boolean(options.body),
      ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
      ...(this.getAuthToken ? { getAuthToken: this.getAuthToken } : {}),
    });
  }

  private buildRequestInit(
    method: HttpMethod,
    headers: Headers,
    signal: AbortSignal,
    body: string | undefined,
  ): RequestInit {
    if (body === undefined) return { method, headers, signal };
    return { method, headers, signal, body };
  }

  private async parseResponse<T>(response: Response, parse: ParseFn<T>): Promise<T> {
    if (response.status === 204) return undefined as T;
    const responseText = await response.text();
    if (responseText === '') return undefined as T;

    const parsed = safeJsonParse(responseText);
    if (!parsed) {
      throw new ControlPlaneClientError(response.status, 'Invalid JSON response');
    }

    return parse(parsed);
  }

  private async throwResponseError(response: Response): Promise<never> {
    const bodyText = await response.text();
    const parsed = safeJsonParse(bodyText);
    if (parsed && isProblemDetails(parsed)) {
      throw new ProblemDetailsError(parsed);
    }
    throw new ControlPlaneClientError(response.status, bodyText);
  }
}
