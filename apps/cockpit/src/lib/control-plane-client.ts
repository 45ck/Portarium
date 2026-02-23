import type {
  ApprovalDecisionRequest,
  ApprovalSummary,
  CursorPage,
  DerivedArtifactListResponse,
  GraphTraversalResult,
  GraphQueryRequest,
  RetrievalSearchRequest,
  RetrievalSearchResponse,
  RunSummary,
  UpdateWorkflowRequest,
  UpdateWorkItemCommand,
  WorkflowDetail,
  WorkflowSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';

interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) return false;
  return (
    typeof value.title === 'string' &&
    typeof value.status === 'number' &&
    (value.type === undefined || typeof value.type === 'string') &&
    (value.detail === undefined || typeof value.detail === 'string') &&
    (value.instance === undefined || typeof value.instance === 'string')
  );
}

export class CockpitApiError extends Error {
  public readonly status: number;
  public readonly problem?: ProblemDetails;
  public readonly rawBody?: string;

  constructor(
    status: number,
    message: string,
    options?: { problem?: ProblemDetails; rawBody?: string },
  ) {
    super(message);
    this.name = 'CockpitApiError';
    this.status = status;
    this.problem = options?.problem;
    this.rawBody = options?.rawBody;
  }
}

interface ControlPlaneClientConfig {
  baseUrl?: string;
  getBearerToken?: () => string | undefined;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = (import.meta.env.VITE_PORTARIUM_API_BASE_URL ?? '').trim();
const DEFAULT_BEARER_TOKEN = (import.meta.env.VITE_PORTARIUM_API_BEARER_TOKEN ?? '').trim();
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultGetBearerToken(): string | undefined {
  if (DEFAULT_BEARER_TOKEN) return DEFAULT_BEARER_TOKEN;
  if (typeof window === 'undefined') return undefined;
  return (
    window.localStorage.getItem('portarium_cockpit_bearer_token') ??
    window.localStorage.getItem('portarium_bearer_token') ??
    undefined
  );
}

export class ControlPlaneClient {
  private readonly baseUrl: string;
  private readonly getBearerToken?: () => string | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ControlPlaneClientConfig = {}) {
    const base = (config.baseUrl ?? DEFAULT_BASE_URL).trim();
    this.baseUrl = base.endsWith('/') ? base.slice(0, -1) : base;
    this.getBearerToken = config.getBearerToken ?? defaultGetBearerToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  public listApprovals(workspaceId: string): Promise<CursorPage<ApprovalSummary>> {
    return this.request(`/v1/workspaces/${workspaceId}/approvals`);
  }

  public getApproval(workspaceId: string, approvalId: string): Promise<ApprovalSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/approvals/${approvalId}`);
  }

  public decideApproval(
    workspaceId: string,
    approvalId: string,
    body: ApprovalDecisionRequest,
    options: { idempotencyKey?: string } = {},
  ): Promise<ApprovalSummary> {
    const headers = new Headers();
    if (options.idempotencyKey) {
      headers.set('Idempotency-Key', options.idempotencyKey);
    }
    return this.request(`/v1/workspaces/${workspaceId}/approvals/${approvalId}/decide`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  public listRuns(workspaceId: string): Promise<CursorPage<RunSummary>> {
    return this.request(`/v1/workspaces/${workspaceId}/runs`);
  }

  public getRun(workspaceId: string, runId: string): Promise<RunSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/runs/${runId}`);
  }

  public startRun(
    workspaceId: string,
    body: { workflowId: string; parameters?: Record<string, unknown> },
  ): Promise<RunSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/runs`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public cancelRun(workspaceId: string, runId: string): Promise<RunSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/runs/${runId}/cancel`, { method: 'POST' });
  }

  public listWorkItems(workspaceId: string): Promise<CursorPage<WorkItemSummary>> {
    return this.request(`/v1/workspaces/${workspaceId}/work-items`);
  }

  public getWorkItem(workspaceId: string, workItemId: string): Promise<WorkItemSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/work-items/${workItemId}`);
  }

  public updateWorkItem(
    workspaceId: string,
    workItemId: string,
    body: UpdateWorkItemCommand,
  ): Promise<WorkItemSummary> {
    return this.request(`/v1/workspaces/${workspaceId}/work-items/${workItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  public listWorkflows(workspaceId: string): Promise<CursorPage<WorkflowSummary>> {
    return this.request(`/v1/workspaces/${workspaceId}/workflows`);
  }

  public getWorkflow(workspaceId: string, workflowId: string): Promise<WorkflowDetail> {
    return this.request(`/v1/workspaces/${workspaceId}/workflows/${workflowId}`);
  }

  public updateWorkflow(
    workspaceId: string,
    workflowId: string,
    body: UpdateWorkflowRequest,
  ): Promise<WorkflowDetail> {
    return this.request(`/v1/workspaces/${workspaceId}/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  public searchRetrieval(
    workspaceId: string,
    body: RetrievalSearchRequest,
  ): Promise<RetrievalSearchResponse> {
    return this.request(`/v1/workspaces/${workspaceId}/retrieval/search`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public queryGraph(workspaceId: string, body: GraphQueryRequest): Promise<GraphTraversalResult> {
    return this.request(`/v1/workspaces/${workspaceId}/graph/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public listDerivedArtifacts(
    workspaceId: string,
    runId: string,
    kind?: string,
  ): Promise<DerivedArtifactListResponse> {
    const params = new URLSearchParams({ runId });
    if (kind) params.set('kind', kind);
    return this.request(`/v1/workspaces/${workspaceId}/derived-artifacts?${params.toString()}`);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getBearerToken?.();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const method = (init.method ?? 'GET').toUpperCase();
    const maxRetries = method === 'GET' || method === 'HEAD' ? 3 : 1;
    let response: Response;

    for (let attempt = 0; ; attempt += 1) {
      try {
        response = await this.fetchImpl(this.resolveUrl(path), { ...init, headers });
      } catch (error) {
        if (!(error instanceof TypeError) || attempt >= maxRetries) {
          throw error;
        }
        await sleep(Math.min(1_500 * 2 ** attempt, 8_000));
        continue;
      }

      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt >= maxRetries) {
        break;
      }
      await sleep(Math.min(1_500 * 2 ** attempt, 8_000));
    }

    if (!response.ok) {
      await this.throwResponseError(response);
    }

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new CockpitApiError(response.status, 'Invalid JSON response body', { rawBody: text });
    }
  }

  private resolveUrl(path: string): string {
    if (!this.baseUrl) return path;
    if (path.startsWith('/')) return `${this.baseUrl}${path}`;
    return `${this.baseUrl}/${path}`;
  }

  private async throwResponseError(response: Response): Promise<never> {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (isProblemDetails(parsed)) {
          throw new CockpitApiError(
            response.status,
            parsed.detail ?? parsed.title ?? `Request failed with status ${response.status}`,
            { problem: parsed, rawBody: text },
          );
        }
      } catch (error) {
        if (error instanceof CockpitApiError) throw error;
      }
    }

    throw new CockpitApiError(
      response.status,
      text || `Request failed with status ${response.status}`,
      { rawBody: text || undefined },
    );
  }
}

export const controlPlaneClient = new ControlPlaneClient();
