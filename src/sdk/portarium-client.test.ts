import { describe, it, expect, vi } from 'vitest';
import {
  PortariumClient,
  PortariumApiError,
  ApprovalTimeoutError,
  type ApprovalSummary,
  type PortariumClientConfig,
  type ProblemDetails,
  type ProposeAgentActionResult,
  type ExecuteAgentActionResult,
  type ApprovalListResult,
  type RunListResult,
  type HealthStatus,
  type PolicyListResult,
  type PolicySummary,
  type SavePolicyResult,
  type MachineListResult,
  type MachineSummary,
  type AgentListResult,
  type AgentSummary,
} from './portarium-client.js';

function mockFetch(status: number, body?: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

/** Extract typed fetch call args from a vitest mock. */
function getCallArgs(fetchFn: typeof fetch, callIndex = 0): [string, RequestInit] {
  const mock = fetchFn as ReturnType<typeof vi.fn>;
  const args = mock.mock.calls[callIndex] as [string, RequestInit];
  return args;
}

/** Get headers from a RequestInit as a plain Record. */
function getHeaders(options: RequestInit): Record<string, string> {
  return options.headers as Record<string, string>;
}

function makeClient(overrides?: Partial<PortariumClientConfig>): PortariumClient {
  return new PortariumClient({
    baseUrl: 'https://api.portarium.test',
    auth: { kind: 'bearerToken', token: 'test-token' },
    workspaceId: 'ws-test',
    timeoutMs: 5000,
    maxRetries: 0,
    fetchFn: mockFetch(200, {}),
    ...overrides,
  });
}

describe('PortariumClient', () => {
  describe('runs.start', () => {
    it('sends POST to the correct endpoint with auth and trace headers', async () => {
      const fetchFn = mockFetch(200, {
        runId: 'run-1',
        workflowId: 'wf-1',
        status: 'Pending',
        createdAtIso: '2026-02-21T00:00:00Z',
      });
      const client = makeClient({
        fetchFn,
        traceparent: '00-abc123-def456-01',
        tracestate: 'portarium=v1',
      });

      const result = await client.runs.start({ workflowId: 'wf-1' });

      expect(result.runId).toBe('run-1');
      expect(fetchFn).toHaveBeenCalledOnce();

      const [url, options] = getCallArgs(fetchFn);
      const headers = getHeaders(options);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/runs');
      expect(options.method).toBe('POST');
      expect(headers['authorization']).toBe('Bearer test-token');
      expect(headers['traceparent']).toBe('00-abc123-def456-01');
      expect(headers['tracestate']).toBe('portarium=v1');
      expect(headers['idempotency-key']).toBeDefined();
      expect(headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('runs.get', () => {
    it('sends GET to the correct endpoint', async () => {
      const fetchFn = mockFetch(200, {
        runId: 'run-1',
        workflowId: 'wf-1',
        status: 'Running',
        createdAtIso: '2026-02-21T00:00:00Z',
      });
      const client = makeClient({ fetchFn });

      const result = await client.runs.get('run-1');

      expect(result.status).toBe('Running');
      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/runs/run-1');
    });
  });

  describe('runs.cancel', () => {
    it('sends POST to the cancel endpoint', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.runs.cancel('run-1');

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/runs/run-1/cancel');
      expect(options.method).toBe('POST');
    });
  });

  describe('approvals.submitDecision', () => {
    it('delegates to decide() and sends POST to /decide endpoint', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.approvals.submitDecision({
        approvalId: 'appr-1',
        decision: 'Approved',
        reason: 'Looks good',
      });

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/approvals/appr-1/decide');
      const body = JSON.parse(options.body as string) as {
        decision: string;
        rationale: string;
      };
      expect(body.decision).toBe('Approved');
      expect(body.rationale).toBe('Looks good');
    });
  });

  describe('approvals.decide', () => {
    it('sends POST to the /decide endpoint with correct payload', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.approvals.decide({
        approvalId: 'appr-2',
        decision: 'Denied',
        reason: 'Not ready',
      });

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/approvals/appr-2/decide');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string) as {
        decision: string;
        rationale: string;
      };
      expect(body.decision).toBe('Denied');
      expect(body.rationale).toBe('Not ready');
    });
  });

  describe('agents.register', () => {
    it('sends POST to agents endpoint', async () => {
      const fetchFn = mockFetch(200, { agentId: 'agent-1' });
      const client = makeClient({ fetchFn });

      await client.agents.register({
        agentId: 'agent-1',
        displayName: 'Test Agent',
        capabilities: ['invoice:read'],
      });

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/agents');
      expect(options.method).toBe('POST');
    });
  });

  describe('agents.heartbeat', () => {
    it('sends POST to heartbeat endpoint', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.agents.heartbeat({ agentId: 'agent-1', statusMessage: 'alive' });

      const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toContain('/agents/agent-1/heartbeat');
    });
  });

  describe('RFC 7807 error mapping', () => {
    it('throws PortariumApiError with ProblemDetails on 4xx', async () => {
      const problem: ProblemDetails = {
        type: 'urn:portarium:error:not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Run run-999 does not exist',
      };
      const fetchFn = mockFetch(404, problem);
      const client = makeClient({ fetchFn });

      await expect(client.runs.get('run-999')).rejects.toThrow(PortariumApiError);
      await expect(client.runs.get('run-999')).rejects.toThrow(/Not Found/);
    });
  });

  describe('retry behavior', () => {
    it('retries on 503 and succeeds on second attempt', async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: () => Promise.resolve({ type: 'about:blank', title: 'Unavailable', status: 503 }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              runId: 'run-1',
              workflowId: 'wf-1',
              status: 'Running',
              createdAtIso: '2026-02-21T00:00:00Z',
            }),
        });
      });

      const client = makeClient({ fetchFn, maxRetries: 2, retryBaseDelayMs: 10 });
      const result = await client.runs.get('run-1');

      expect(result.runId).toBe('run-1');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('correlation ID injection', () => {
    it('includes x-correlation-id header on every request', async () => {
      const fetchFn = mockFetch(200, {});
      const client = makeClient({ fetchFn });

      await client.runs.get('run-1');

      const [, options] = getCallArgs(fetchFn);
      const headers = getHeaders(options);
      expect(headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('mTLS auth provider', () => {
    it('includes x-client-cert header for mTLS auth', async () => {
      const fetchFn = mockFetch(200, {});
      const client = makeClient({
        fetchFn,
        auth: { kind: 'mtlsBoundToken', token: 'mtls-token', clientCert: 'cert-pem' },
      });

      await client.runs.get('run-1');

      const [, options] = getCallArgs(fetchFn);
      const headers = getHeaders(options);
      expect(headers['authorization']).toBe('Bearer mtls-token');
      expect(headers['x-client-cert']).toBe('cert-pem');
    });
  });

  describe('events.subscribe', () => {
    it('returns an event subscription with unsubscribe', () => {
      const client = makeClient();
      const onEvent = vi.fn();

      const sub = client.events.subscribe(onEvent);

      expect(sub.onEvent).toBe(onEvent);
      expect(typeof sub.unsubscribe).toBe('function');
      sub.unsubscribe(); // should not throw
    });

    it('initiates a fetch to the SSE endpoint with auth headers', async () => {
      // Mock a fetch that returns a streaming response
      const mockReadableStream = (): ReadableStream => {
        const encoder = new TextEncoder();
        const data = encoder.encode('data: {"type":"test"}\n\n');
        return new ReadableStream({
          start(controller) {
            controller.enqueue(data);
            controller.close();
          },
        });
      };

      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream(),
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const events: unknown[] = [];
      const client = makeClient({ fetchFn });
      const sub = client.events.subscribe((e) => events.push(e));

      // Wait briefly for the async stream processing
      await new Promise((resolve) => setTimeout(resolve, 50));
      sub.unsubscribe();

      expect(fetchFn).toHaveBeenCalledOnce();
      const [url, opts] = getCallArgs(fetchFn);
      expect(url).toContain('/events:stream');
      const headers = getHeaders(opts);
      expect(headers['accept']).toBe('text/event-stream');
      expect(headers['authorization']).toBe('Bearer test-token');
      // Event data should have been parsed
      expect(events).toContainEqual({ type: 'test' });
    });
  });

  describe('approvals.get', () => {
    it('sends GET to the correct approvals endpoint', async () => {
      const summary: ApprovalSummary = {
        approvalId: 'appr-1',
        status: 'Pending',
      };
      const fetchFn = mockFetch(200, summary);
      const client = makeClient({ fetchFn });

      const result = await client.approvals.get('appr-1');

      expect(result.approvalId).toBe('appr-1');
      expect(result.status).toBe('Pending');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/approvals/appr-1');
      expect(options.method).toBe('GET');
    });

    it('throws PortariumApiError on 404', async () => {
      const problem: ProblemDetails = {
        type: 'https://portarium.dev/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Approval appr-999 not found.',
      };
      const fetchFn = mockFetch(404, problem);
      const client = makeClient({ fetchFn });

      await expect(client.approvals.get('appr-999')).rejects.toThrow(PortariumApiError);
    });
  });

  describe('agentActions.propose', () => {
    it('sends POST to the agent-actions:propose endpoint with idempotency key', async () => {
      const proposalResult: ProposeAgentActionResult = {
        proposalId: 'prop-1',
        decision: 'Allow',
      };
      const fetchFn = mockFetch(200, proposalResult);
      const client = makeClient({ fetchFn });

      const result = await client.agentActions.propose({
        agentId: 'agent-1',
        actionKind: 'send_email',
        toolName: 'email.send',
        parameters: { to: 'user@example.com' },
      });

      expect(result.proposalId).toBe('prop-1');
      expect(result.decision).toBe('Allow');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/agent-actions:propose');
      expect(options.method).toBe('POST');
      const headers = getHeaders(options);
      expect(headers['idempotency-key']).toBeDefined();
    });

    it('uses caller-supplied idempotencyKey when provided', async () => {
      const proposalResult: ProposeAgentActionResult = {
        proposalId: 'prop-2',
        decision: 'NeedsApproval',
        approvalId: 'appr-10',
      };
      const fetchFn = mockFetch(200, proposalResult);
      const client = makeClient({ fetchFn });

      await client.agentActions.propose({
        agentId: 'agent-1',
        actionKind: 'delete_record',
        idempotencyKey: 'my-idem-key',
      });

      const [, options] = getCallArgs(fetchFn);
      const headers = getHeaders(options);
      expect(headers['idempotency-key']).toBe('my-idem-key');
    });

    it('throws PortariumApiError on 403 Denied', async () => {
      const problem: ProblemDetails = {
        type: 'urn:portarium:error:forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Action denied by policy.',
      };
      const fetchFn = mockFetch(403, problem);
      const client = makeClient({ fetchFn });

      await expect(
        client.agentActions.propose({ agentId: 'agent-1', actionKind: 'nuke' }),
      ).rejects.toThrow(PortariumApiError);
    });
  });

  describe('agentActions.execute', () => {
    it('sends POST to the agent-actions/:approvalId/execute endpoint', async () => {
      const execResult: ExecuteAgentActionResult = {
        executionId: 'exec-1',
        approvalId: 'appr-10',
        status: 'Executed',
      };
      const fetchFn = mockFetch(200, execResult);
      const client = makeClient({ fetchFn });

      const result = await client.agentActions.execute('appr-10', {
        flowRef: 'machine-1/tool-name',
        idempotencyKey: 'execute-sdk-1',
      });

      expect(result.status).toBe('Executed');
      expect(result.approvalId).toBe('appr-10');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/agent-actions/appr-10/execute');
      expect(options.method).toBe('POST');
      expect((options.headers as Record<string, string>)['idempotency-key']).toBe('execute-sdk-1');
    });

    it('accepts an in-progress execution response', async () => {
      const execResult: ExecuteAgentActionResult = {
        executionId: 'exec-2',
        approvalId: 'appr-20',
        status: 'Executing',
      };
      const fetchFn = mockFetch(200, execResult);
      const client = makeClient({ fetchFn });

      const result = await client.agentActions.execute('appr-20', {
        flowRef: 'machine-1/tool-name',
      });

      expect(result.approvalId).toBe('appr-20');
      expect(result.status).toBe('Executing');
      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/agent-actions/appr-20/execute');
    });

    it('URL-encodes the approvalId', async () => {
      const execResult: ExecuteAgentActionResult = {
        executionId: 'exec-3',
        approvalId: 'appr with spaces',
        status: 'Executed',
      };
      const fetchFn = mockFetch(200, execResult);
      const client = makeClient({ fetchFn });

      await client.agentActions.execute('appr with spaces', {
        flowRef: 'machine-1/tool-name',
      });

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/agent-actions/appr%20with%20spaces/execute');
    });
  });

  describe('approvals.list', () => {
    it('sends GET to the approvals list endpoint with no filter', async () => {
      const listResult: ApprovalListResult = {
        items: [{ approvalId: 'appr-1', status: 'Pending' }],
      };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      const result = await client.approvals.list();

      expect(result.items).toHaveLength(1);
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/approvals');
      expect(options.method).toBe('GET');
    });

    it('appends query parameters when filter is provided', async () => {
      const listResult: ApprovalListResult = { items: [] };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      await client.approvals.list({ status: 'Approved', runId: 'run-42', limit: 10 });

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('status=Approved');
      expect(url).toContain('runId=run-42');
      expect(url).toContain('limit=10');
    });
  });

  describe('runs.list', () => {
    it('sends GET to the runs list endpoint with no filter', async () => {
      const listResult: RunListResult = {
        items: [
          {
            runId: 'run-1',
            workflowId: 'wf-1',
            status: 'Running',
            createdAtIso: '2026-03-11T00:00:00Z',
          },
        ],
      };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      const result = await client.runs.list();

      expect(result.items).toHaveLength(1);
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/runs');
      expect(options.method).toBe('GET');
    });

    it('appends limit query parameter when provided', async () => {
      const listResult: RunListResult = { items: [] };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      await client.runs.list({ limit: 5 });

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('limit=5');
    });
  });

  describe('agentActions.waitForApproval', () => {
    it('calls execute() when approval is already Approved', async () => {
      const approvalSummary: ApprovalSummary = {
        approvalId: 'appr-10',
        status: 'Approved',
        decidedAt: '2026-03-11T10:00:00Z',
      };
      const execResult: ExecuteAgentActionResult = {
        executionId: 'exec-1',
        approvalId: 'appr-10',
        status: 'Executed',
      };
      // First call returns the approval GET; second call returns execute result
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        callCount++;
        const body = callCount === 1 ? approvalSummary : execResult;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        });
      });
      const client = makeClient({ fetchFn, maxRetries: 0 });

      const result = await client.agentActions.waitForApproval('appr-10', {
        flowRef: 'machine-1/tool-name',
      });

      expect(result.status).toBe('Executed');
      expect(result.approvalId).toBe('appr-10');
      // First call: GET approval, second call: POST execute
      expect(callCount).toBe(2);
      const [, executeOptions] = getCallArgs(fetchFn, 1);
      expect(executeOptions.method).toBe('POST');
      const [executeUrl] = getCallArgs(fetchFn, 1);
      expect(executeUrl).toContain('/agent-actions/appr-10/execute');
    });

    it('throws when approval is Denied', async () => {
      const approvalSummary: ApprovalSummary = {
        approvalId: 'appr-20',
        status: 'Denied',
        decidedAt: '2026-03-11T10:00:00Z',
      };
      const fetchFn = mockFetch(200, approvalSummary);
      const client = makeClient({ fetchFn, maxRetries: 0 });

      await expect(
        client.agentActions.waitForApproval('appr-20', { flowRef: 'machine-1/tool-name' }),
      ).rejects.toThrow(/denied/i);
    });

    it('throws when approval is Expired', async () => {
      const approvalSummary: ApprovalSummary = {
        approvalId: 'appr-30',
        status: 'Expired',
      };
      const fetchFn = mockFetch(200, approvalSummary);
      const client = makeClient({ fetchFn, maxRetries: 0 });

      await expect(
        client.agentActions.waitForApproval('appr-30', { flowRef: 'machine-1/tool-name' }),
      ).rejects.toThrow(/expired/i);
    });
  });

  describe('approvals.waitFor', () => {
    it('resolves immediately when approval is already non-Pending', async () => {
      const summary: ApprovalSummary = {
        approvalId: 'appr-2',
        status: 'Approved',
        decidedAt: '2026-03-10T12:00:00Z',
      };
      const fetchFn = mockFetch(200, summary);
      const client = makeClient({ fetchFn });

      const result = await client.approvals.waitFor('appr-2');

      expect(result.status).toBe('Approved');
      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it('polls until approval reaches a terminal state', async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        callCount++;
        const status = callCount < 3 ? 'Pending' : 'Approved';
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ approvalId: 'appr-3', status } satisfies ApprovalSummary),
        });
      });

      const client = makeClient({ fetchFn, maxRetries: 0 });
      const result = await client.approvals.waitFor('appr-3', { pollIntervalMs: 10 });

      expect(result.status).toBe('Approved');
      expect(callCount).toBe(3);
    });

    it('throws ApprovalTimeoutError when timeout is exceeded', async () => {
      const fetchFn = mockFetch(200, {
        approvalId: 'appr-4',
        status: 'Pending',
      } satisfies ApprovalSummary);
      const client = makeClient({ fetchFn, maxRetries: 0 });

      await expect(
        client.approvals.waitFor('appr-4', { pollIntervalMs: 10, timeout: 50 }),
      ).rejects.toThrow(ApprovalTimeoutError);
    });

    it('ApprovalTimeoutError carries the approvalId', async () => {
      const fetchFn = mockFetch(200, {
        approvalId: 'appr-5',
        status: 'Pending',
      } satisfies ApprovalSummary);
      const client = makeClient({ fetchFn, maxRetries: 0 });

      try {
        await client.approvals.waitFor('appr-5', { pollIntervalMs: 10, timeout: 50 });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApprovalTimeoutError);
        expect((err as ApprovalTimeoutError).approvalId).toBe('appr-5');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // health
  // ---------------------------------------------------------------------------

  describe('health', () => {
    it('sends GET to /healthz', async () => {
      const healthBody: HealthStatus = { service: 'control-plane', status: 'ok' };
      const fetchFn = mockFetch(200, healthBody);
      const client = makeClient({ fetchFn });

      const result = await client.health();

      expect(result.service).toBe('control-plane');
      expect(result.status).toBe('ok');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/healthz');
      expect(options.method).toBe('GET');
    });
  });

  // ---------------------------------------------------------------------------
  // machines.list / machines.get
  // ---------------------------------------------------------------------------

  describe('machines.list', () => {
    it('sends GET to the machines list endpoint', async () => {
      const listResult: MachineListResult = {
        items: [{ machineId: 'mach-1', displayName: 'M1', endpoint: 'http://m1' }],
      };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      const result = await client.machines.list();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.machineId).toBe('mach-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/machines');
      expect(options.method).toBe('GET');
    });
  });

  describe('machines.get', () => {
    it('sends GET to the machine detail endpoint', async () => {
      const machine: MachineSummary = {
        machineId: 'mach-1',
        displayName: 'M1',
        endpoint: 'http://m1',
      };
      const fetchFn = mockFetch(200, machine);
      const client = makeClient({ fetchFn });

      const result = await client.machines.get('mach-1');

      expect(result.machineId).toBe('mach-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/machines/mach-1');
      expect(options.method).toBe('GET');
    });

    it('URL-encodes the machineId', async () => {
      const fetchFn = mockFetch(200, { machineId: 'mach with spaces' });
      const client = makeClient({ fetchFn });

      await client.machines.get('mach with spaces');

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/machines/mach%20with%20spaces');
    });
  });

  // ---------------------------------------------------------------------------
  // agents.list / agents.get
  // ---------------------------------------------------------------------------

  describe('agents.list', () => {
    it('sends GET to the agents list endpoint', async () => {
      const listResult: AgentListResult = {
        items: [{ agentId: 'agent-1', displayName: 'A1' }],
      };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      const result = await client.agents.list();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.agentId).toBe('agent-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/agents');
      expect(options.method).toBe('GET');
    });
  });

  describe('agents.get', () => {
    it('sends GET to the agent detail endpoint', async () => {
      const agent: AgentSummary = { agentId: 'agent-1', displayName: 'A1' };
      const fetchFn = mockFetch(200, agent);
      const client = makeClient({ fetchFn });

      const result = await client.agents.get('agent-1');

      expect(result.agentId).toBe('agent-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/agents/agent-1');
      expect(options.method).toBe('GET');
    });

    it('URL-encodes the agentId', async () => {
      const fetchFn = mockFetch(200, { agentId: 'agent with spaces' });
      const client = makeClient({ fetchFn });

      await client.agents.get('agent with spaces');

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/agents/agent%20with%20spaces');
    });
  });

  // ---------------------------------------------------------------------------
  // policies.list / policies.get / policies.save
  // ---------------------------------------------------------------------------

  describe('policies.list', () => {
    it('sends GET to the policies list endpoint', async () => {
      const listResult: PolicyListResult = {
        items: [{ policyId: 'pol-1', name: 'Default' }],
      };
      const fetchFn = mockFetch(200, listResult);
      const client = makeClient({ fetchFn });

      const result = await client.policies.list();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.policyId).toBe('pol-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/policies');
      expect(options.method).toBe('GET');
    });
  });

  describe('policies.get', () => {
    it('sends GET to the policy detail endpoint', async () => {
      const policy: PolicySummary = { policyId: 'pol-1', name: 'Default' };
      const fetchFn = mockFetch(200, policy);
      const client = makeClient({ fetchFn });

      const result = await client.policies.get('pol-1');

      expect(result.policyId).toBe('pol-1');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/policies/pol-1');
      expect(options.method).toBe('GET');
    });

    it('URL-encodes the policyId', async () => {
      const fetchFn = mockFetch(200, { policyId: 'pol with spaces' });
      const client = makeClient({ fetchFn });

      await client.policies.get('pol with spaces');

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/policies/pol%20with%20spaces');
    });
  });

  describe('policies.save', () => {
    it('sends POST to the policies endpoint', async () => {
      const saveResult: SavePolicyResult = { policyId: 'pol-new' };
      const fetchFn = mockFetch(201, saveResult);
      const client = makeClient({ fetchFn });

      const result = await client.policies.save({
        policyId: 'pol-new',
        name: 'New Policy',
        rules: [],
      });

      expect(result.policyId).toBe('pol-new');
      const [url, options] = getCallArgs(fetchFn);
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/policies');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['policyId']).toBe('pol-new');
      expect(body['name']).toBe('New Policy');
    });
  });

  // ---------------------------------------------------------------------------
  // machines.register (existing coverage — verify correct endpoint)
  // ---------------------------------------------------------------------------

  describe('machines.register', () => {
    it('sends POST to machines endpoint', async () => {
      const fetchFn = mockFetch(200, { machineId: 'mach-1' });
      const client = makeClient({ fetchFn });

      await client.machines.register({
        machineId: 'mach-1',
        displayName: 'Machine 1',
        endpoint: 'http://mach1.local',
      });

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/machines');
      expect(options.method).toBe('POST');
    });
  });

  describe('machines.heartbeat', () => {
    it('sends POST to heartbeat endpoint', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.machines.heartbeat({ machineId: 'mach-1', statusMessage: 'alive' });

      const [url] = getCallArgs(fetchFn);
      expect(url).toContain('/machines/mach-1/heartbeat');
    });
  });
});
