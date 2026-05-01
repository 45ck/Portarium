/**
 * PortariumClient -- ergonomic facade for the Portarium Control Plane API.
 *
 * Beads: bead-0661, bead-0678, bead-0939
 *
 * Features:
 * - Namespace-scoped methods (runs, approvals, agents, machines, policies, events)
 * - Automatic idempotency key generation (crypto.randomUUID)
 * - W3C traceparent/tracestate injection on every request
 * - Retry with exponential backoff for transient failures
 * - RFC 7807 Problem Details error mapping
 * - Pluggable auth providers (bearer token, mTLS-bound token)
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Auth providers
// ---------------------------------------------------------------------------

export type AuthProvider =
  | Readonly<{ kind: 'bearerToken'; token: string }>
  | Readonly<{ kind: 'mtlsBoundToken'; token: string; clientCert: string }>;

// ---------------------------------------------------------------------------
// RFC 7807 Problem Details
// ---------------------------------------------------------------------------

export type ProblemDetails = Readonly<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}>;

export class PortariumApiError extends Error {
  public override readonly name = 'PortariumApiError';
  public readonly problem: ProblemDetails;

  public constructor(problem: ProblemDetails) {
    super(`${problem.title} (${problem.status}): ${problem.detail ?? 'No detail'}`);
    this.problem = problem;
  }
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export type PortariumClientConfig = Readonly<{
  baseUrl: string;
  auth: AuthProvider;
  workspaceId: string;
  /** Timeout per request in ms. Default: 30000. */
  timeoutMs?: number;
  /** Max retry attempts for transient failures. Default: 3. */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms. Default: 500. */
  retryBaseDelayMs?: number;
  /** Optional fetch implementation for testing. */
  fetchFn?: typeof fetch;
  /** Optional traceparent for W3C distributed tracing. */
  traceparent?: string;
  /** Optional tracestate for W3C distributed tracing. */
  tracestate?: string;
}>;

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

export type StartRunInput = Readonly<{
  workflowId: string;
  executionTier?: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  idempotencyKey?: string;
}>;

export type RunSummary = Readonly<{
  runId: string;
  workflowId: string;
  status: string;
  createdAtIso: string;
}>;

export type ApprovalDecisionInput = Readonly<{
  approvalId: string;
  decision: 'Approved' | 'Denied' | 'RequestChanges';
  reason?: string;
}>;

export type ApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Executing'
  | 'Denied'
  | 'Executed'
  | 'Expired'
  | 'RequestChanges';

export type ApprovalSummary = Readonly<{
  approvalId: string;
  status: ApprovalStatus;
  decidedAt?: string;
  rationale?: string;
}>;

export type WaitForApprovalOpts = Readonly<{
  /** Polling interval in ms. Default: 2000 ms. */
  pollIntervalMs?: number;
  /** Maximum ms to wait before throwing ApprovalTimeoutError. Default: Infinity. */
  timeout?: number;
}>;

export class ApprovalTimeoutError extends Error {
  public override readonly name = 'ApprovalTimeoutError';
  public readonly approvalId: string;

  public constructor(approvalId: string, timeoutMs: number) {
    super(`Approval ${approvalId} did not reach a terminal state within ${timeoutMs} ms.`);
    this.approvalId = approvalId;
  }
}

export type AgentRegistrationInput = Readonly<{
  agentId: string;
  displayName: string;
  capabilities?: readonly string[];
}>;

export type AgentHeartbeatInput = Readonly<{
  agentId: string;
  statusMessage?: string;
}>;

export type MachineRegistrationInput = Readonly<{
  machineId: string;
  displayName: string;
  endpoint: string;
}>;

export type MachineHeartbeatInput = Readonly<{
  machineId: string;
  statusMessage?: string;
}>;

export type EventSubscription = Readonly<{
  onEvent: (event: unknown) => void;
  unsubscribe: () => void;
}>;

export type ProposeAgentActionInput = Readonly<{
  agentId: string;
  actionKind: string;
  toolName?: string;
  parameters?: Record<string, unknown>;
  executionTier?: 'Auto' | 'Assisted' | 'HumanApprove' | 'ManualOnly';
  policyIds?: string[];
  rationale?: string;
  idempotencyKey?: string;
}>;

export type ProposeAgentActionResult = Readonly<{
  proposalId: string;
  decision: 'Allow' | 'NeedsApproval' | 'Denied';
  approvalId?: string;
  message?: string;
}>;

export type ExecuteAgentActionInput = Readonly<{
  flowRef: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  idempotencyKey?: string;
}>;

export type ExecuteAgentActionResult = Readonly<{
  executionId: string;
  approvalId: string;
  status: 'Executing' | 'Executed' | 'Failed';
  output?: unknown;
  errorMessage?: string;
}>;

// ---------- health ----------
export type HealthStatus = Readonly<{
  service: string;
  status: string;
  [key: string]: unknown;
}>;

// ---------- policy types ----------
export type PolicySummary = Readonly<{
  policyId: string;
  [key: string]: unknown;
}>;

export type PolicyListResult = Readonly<{
  items: readonly PolicySummary[];
}>;

export type SavePolicyInput = Readonly<{
  policyId: string;
  [key: string]: unknown;
}>;

export type SavePolicyResult = Readonly<{
  policyId: string;
}>;

// ---------- machine/agent list types ----------
export type MachineSummary = Readonly<{
  machineId: string;
  [key: string]: unknown;
}>;

export type MachineListResult = Readonly<{
  items: readonly MachineSummary[];
}>;

export type AgentSummary = Readonly<{
  agentId: string;
  [key: string]: unknown;
}>;

export type AgentListResult = Readonly<{
  items: readonly AgentSummary[];
}>;

// ---------- list types ----------
export type ListApprovalsFilter = Readonly<{
  status?: ApprovalStatus;
  runId?: string;
  limit?: number;
}>;

export type ApprovalListResult = Readonly<{
  items: readonly ApprovalSummary[];
}>;

export type ListRunsFilter = Readonly<{
  limit?: number;
}>;

export type RunListResult = Readonly<{
  items: readonly RunSummary[];
}>;

// ---------------------------------------------------------------------------
// PortariumClient
// ---------------------------------------------------------------------------

export class PortariumClient {
  readonly #config: Required<
    Pick<
      PortariumClientConfig,
      'baseUrl' | 'auth' | 'workspaceId' | 'timeoutMs' | 'maxRetries' | 'retryBaseDelayMs'
    >
  > & { fetchFn: typeof fetch; traceparent?: string; tracestate?: string };

  public readonly runs: RunsNamespace;
  public readonly approvals: ApprovalsNamespace;
  public readonly agents: AgentsNamespace;
  public readonly machines: MachinesNamespace;
  public readonly agentActions: AgentActionsNamespace;
  public readonly policies: PoliciesNamespace;
  public readonly events: EventsNamespace;

  public constructor(config: PortariumClientConfig) {
    this.#config = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      auth: config.auth,
      workspaceId: config.workspaceId,
      timeoutMs: config.timeoutMs ?? 30_000,
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelayMs: config.retryBaseDelayMs ?? 500,
      fetchFn: config.fetchFn ?? fetch,
      ...(config.traceparent !== undefined ? { traceparent: config.traceparent } : {}),
      ...(config.tracestate !== undefined ? { tracestate: config.tracestate } : {}),
    };

    this.runs = new RunsNamespace(this);
    this.approvals = new ApprovalsNamespace(this);
    this.agents = new AgentsNamespace(this);
    this.machines = new MachinesNamespace(this);
    this.agentActions = new AgentActionsNamespace(this);
    this.policies = new PoliciesNamespace(this);
    this.events = new EventsNamespace(this);
  }

  /** Check the health of the control-plane server. */
  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>('GET', '/healthz');
  }

  /** @internal */
  get workspaceId(): string {
    return this.#config.workspaceId;
  }

  /** @internal -- base URL without trailing slash, used by EventsNamespace. */
  get baseUrl(): string {
    return this.#config.baseUrl;
  }

  /** @internal -- fetch implementation, used by EventsNamespace for streaming. */
  get fetchFn(): typeof fetch {
    return this.#config.fetchFn;
  }

  /** @internal -- build auth + trace headers without content-type (for SSE). */
  buildSseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: 'text/event-stream',
      'x-correlation-id': randomUUID(),
    };
    if (this.#config.auth.kind === 'bearerToken') {
      headers['authorization'] = `Bearer ${this.#config.auth.token}`;
    } else {
      headers['authorization'] = `Bearer ${this.#config.auth.token}`;
      headers['x-client-cert'] = this.#config.auth.clientCert;
    }
    if (this.#config.traceparent) {
      headers['traceparent'] = this.#config.traceparent;
    }
    if (this.#config.tracestate) {
      headers['tracestate'] = this.#config.tracestate;
    }
    return headers;
  }

  /** @internal */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${this.#config.baseUrl}${path}`;
    const headers = this.#buildHeaders(idempotencyKey);

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.#config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.#config.retryBaseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
      try {
        return await this.#attemptRequest<T>(url, method, headers, body);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err instanceof PortariumApiError && !isRetryableStatus(err.problem.status)) {
          throw err;
        }
        lastError = err;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  #buildHeaders(idempotencyKey?: string): Record<string, string> {
    const correlationId = randomUUID();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-correlation-id': correlationId,
    };

    if (this.#config.auth.kind === 'bearerToken') {
      headers['authorization'] = `Bearer ${this.#config.auth.token}`;
    } else {
      headers['authorization'] = `Bearer ${this.#config.auth.token}`;
      headers['x-client-cert'] = this.#config.auth.clientCert;
    }

    if (this.#config.traceparent) {
      headers['traceparent'] = this.#config.traceparent;
    }
    if (this.#config.tracestate) {
      headers['tracestate'] = this.#config.tracestate;
    }
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    return headers;
  }

  async #attemptRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#config.timeoutMs);

    try {
      const response = await this.#config.fetchFn(url, {
        method,
        headers,
        signal: controller.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      const problem = await parseProblemResponse(response);
      throw new PortariumApiError(problem);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(String(error), { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ---------------------------------------------------------------------------
// Namespace implementations
// ---------------------------------------------------------------------------

class RunsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async start(input: StartRunInput): Promise<RunSummary> {
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    return this.#client.request<RunSummary>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/runs`,
      { workflowId: input.workflowId, executionTier: input.executionTier ?? 'Auto' },
      idempotencyKey,
    );
  }

  async get(runId: string): Promise<RunSummary> {
    return this.#client.request<RunSummary>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/runs/${encodeURIComponent(runId)}`,
    );
  }

  async cancel(runId: string): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/runs/${encodeURIComponent(runId)}/cancel`,
    );
  }

  async list(filter: ListRunsFilter = {}): Promise<RunListResult> {
    const params = new URLSearchParams();
    if (filter.limit !== undefined) params.set('limit', String(filter.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.#client.request<RunListResult>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/runs${query}`,
    );
  }
}

class ApprovalsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  /**
   * @deprecated Use `decide()` instead. This method delegates to `decide()`.
   */
  async submitDecision(input: ApprovalDecisionInput): Promise<void> {
    await this.decide(input);
  }

  /**
   * Submit a decision on an approval.
   *
   * Maps to: POST /v1/workspaces/:ws/approvals/:approvalId/decide
   */
  async decide(input: ApprovalDecisionInput): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/approvals/${encodeURIComponent(input.approvalId)}/decide`,
      { decision: input.decision, rationale: input.reason },
    );
  }

  /**
   * Retrieve the current state of an approval.
   * Throws PortariumApiError (status 404) if the approval does not exist.
   */
  async get(approvalId: string): Promise<ApprovalSummary> {
    return this.#client.request<ApprovalSummary>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/approvals/${encodeURIComponent(approvalId)}`,
    );
  }

  async list(filter: ListApprovalsFilter = {}): Promise<ApprovalListResult> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.runId) params.set('runId', filter.runId);
    if (filter.limit !== undefined) params.set('limit', String(filter.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.#client.request<ApprovalListResult>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/approvals${query}`,
    );
  }

  /**
   * Poll until the approval reaches a terminal status (not 'Pending').
   *
   * Polling uses exponential backoff starting at `pollIntervalMs` (default: 2000 ms),
   * capped at 30 000 ms.
   *
   * When `timeout !== Infinity` and the deadline is exceeded, throws `ApprovalTimeoutError`.
   */
  async waitFor(approvalId: string, opts: WaitForApprovalOpts = {}): Promise<ApprovalSummary> {
    const { pollIntervalMs = 2_000, timeout = Infinity } = opts;
    const deadline = timeout === Infinity ? Infinity : Date.now() + timeout;
    let intervalMs = pollIntervalMs;
    const MAX_INTERVAL_MS = 30_000;

    for (;;) {
      const approval = await this.get(approvalId);
      if (approval.status !== 'Pending') {
        return approval;
      }

      if (deadline !== Infinity && Date.now() >= deadline) {
        throw new ApprovalTimeoutError(approvalId, timeout);
      }

      await sleep(intervalMs);
      // Exponential backoff capped at MAX_INTERVAL_MS
      intervalMs = Math.min(intervalMs * 2, MAX_INTERVAL_MS);
    }
  }
}

class AgentsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async register(input: AgentRegistrationInput): Promise<unknown> {
    return this.#client.request(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agents`,
      input,
    );
  }

  async list(): Promise<AgentListResult> {
    return this.#client.request<AgentListResult>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agents`,
    );
  }

  async get(agentId: string): Promise<AgentSummary> {
    return this.#client.request<AgentSummary>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agents/${encodeURIComponent(agentId)}`,
    );
  }

  async heartbeat(input: AgentHeartbeatInput): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agents/${encodeURIComponent(input.agentId)}/heartbeat`,
      { statusMessage: input.statusMessage },
    );
  }
}

class MachinesNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async register(input: MachineRegistrationInput): Promise<unknown> {
    return this.#client.request(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/machines`,
      input,
    );
  }

  async list(): Promise<MachineListResult> {
    return this.#client.request<MachineListResult>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/machines`,
    );
  }

  async get(machineId: string): Promise<MachineSummary> {
    return this.#client.request<MachineSummary>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/machines/${encodeURIComponent(machineId)}`,
    );
  }

  async heartbeat(input: MachineHeartbeatInput): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/machines/${encodeURIComponent(input.machineId)}/heartbeat`,
      { statusMessage: input.statusMessage },
    );
  }
}

class AgentActionsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async propose(input: ProposeAgentActionInput): Promise<ProposeAgentActionResult> {
    return this.#client.request<ProposeAgentActionResult>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agent-actions:propose`,
      input,
      input.idempotencyKey ?? randomUUID(),
    );
  }

  async execute(
    approvalId: string,
    input: ExecuteAgentActionInput,
  ): Promise<ExecuteAgentActionResult> {
    return this.#client.request<ExecuteAgentActionResult>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/agent-actions/${encodeURIComponent(approvalId)}/execute`,
      input,
      input.idempotencyKey,
    );
  }

  /**
   * Poll until the approval transitions out of Pending, then call execute().
   * Returns the execute result. Throws if the approval is Denied or Expired.
   */
  async waitForApproval(
    approvalId: string,
    executeInput: ExecuteAgentActionInput,
    opts: { pollInterval?: number; timeout?: number } = {},
  ): Promise<ExecuteAgentActionResult> {
    const pollIntervalMs = opts.pollInterval ?? 2_000;
    const deadline = opts.timeout !== undefined ? Date.now() + opts.timeout : Infinity;

    for (;;) {
      const approval = await this.#client.approvals.waitFor(approvalId, {
        timeout: Math.min(pollIntervalMs * 2, 30_000),
        pollIntervalMs,
      });

      if (approval.status === 'Approved') {
        return this.execute(approvalId, executeInput);
      }
      if (approval.status === 'Denied') {
        throw new Error(`Approval ${approvalId} was denied`);
      }
      if (approval.status === 'Expired') {
        throw new Error(`Approval ${approvalId} expired`);
      }
      // Still Pending (shouldn't happen since waitFor polls to terminal) -- check timeout
      if (deadline !== Infinity && Date.now() >= deadline) {
        throw new Error(`waitForApproval timed out waiting for approval ${approvalId}`);
      }
    }
  }
}

class PoliciesNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async list(): Promise<PolicyListResult> {
    return this.#client.request<PolicyListResult>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/policies`,
    );
  }

  async get(policyId: string): Promise<PolicySummary> {
    return this.#client.request<PolicySummary>(
      'GET',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/policies/${encodeURIComponent(policyId)}`,
    );
  }

  async save(input: SavePolicyInput): Promise<SavePolicyResult> {
    return this.#client.request<SavePolicyResult>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/policies`,
      input,
    );
  }
}

class EventsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  /**
   * Subscribe to the workspace SSE event stream.
   *
   * Connects to `GET /v1/workspaces/:id/events:stream` using a streaming
   * fetch (works in Node.js 18+ and modern browsers).
   *
   * Each server-sent `data:` line is parsed as JSON and forwarded to `onEvent`.
   * Call `unsubscribe()` to abort the connection.
   */
  subscribe(onEvent: (event: unknown) => void): EventSubscription {
    const controller = new AbortController();
    const { signal } = controller;

    const workspaceId = this.#client.workspaceId;
    // Path matches the Hono route: GET /v1/workspaces/:workspaceId/events:stream
    const url = `${this.#client.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/events:stream`;
    const headers = this.#client.buildSseHeaders();
    const fetchFn = this.#client.fetchFn;

    // Start streaming in background; errors are silently ignored to avoid
    // crashing the caller (connection drops are expected in SSE lifecycles).
    void (async () => {
      try {
        const response = await fetchFn(url, { headers, signal });
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const raw = line.slice(5).trim();
              if (raw) {
                try {
                  onEvent(JSON.parse(raw));
                } catch {
                  // Non-JSON data line -- forward as raw string
                  onEvent(raw);
                }
              }
            }
          }
        }
      } catch {
        // Connection closed or aborted -- silently exit
      }
    })();

    return {
      onEvent,
      unsubscribe() {
        controller.abort();
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function parseProblemResponse(response: Response): Promise<ProblemDetails> {
  try {
    const body = await response.json();
    if (typeof body === 'object' && body !== null && 'type' in body && 'title' in body) {
      return body as ProblemDetails;
    }
  } catch {
    // Fall through to default
  }
  return {
    type: 'about:blank',
    title: response.statusText || 'Unknown Error',
    status: response.status,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
