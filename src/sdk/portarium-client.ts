/**
 * PortariumClient -- ergonomic facade for the Portarium Control Plane API.
 *
 * Beads: bead-0661, bead-0678
 *
 * Features:
 * - Namespace-scoped methods (runs, approvals, agents, machines, events)
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
    this.events = new EventsNamespace();
  }

  /** @internal */
  get workspaceId(): string {
    return this.#config.workspaceId;
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
      throw new Error(String(error));
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
}

class ApprovalsNamespace {
  readonly #client: PortariumClient;
  constructor(client: PortariumClient) {
    this.#client = client;
  }

  async submitDecision(input: ApprovalDecisionInput): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/approvals/${encodeURIComponent(input.approvalId)}/decision`,
      { decision: input.decision, reason: input.reason },
    );
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

  async heartbeat(input: MachineHeartbeatInput): Promise<void> {
    await this.#client.request<void>(
      'POST',
      `/v1/workspaces/${encodeURIComponent(this.#client.workspaceId)}/machines/${encodeURIComponent(input.machineId)}/heartbeat`,
      { statusMessage: input.statusMessage },
    );
  }
}

class EventsNamespace {
  subscribe(onEvent: (event: unknown) => void): EventSubscription {
    // Placeholder: real implementation uses NATS or SSE subscription
    return {
      onEvent,
      unsubscribe() {
        // No-op until NATS/SSE subscription lifecycle is wired
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
