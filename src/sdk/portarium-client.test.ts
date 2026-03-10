import { describe, it, expect, vi } from 'vitest';
import {
  PortariumClient,
  PortariumApiError,
  ApprovalTimeoutError,
  type ApprovalSummary,
  type PortariumClientConfig,
  type ProblemDetails,
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
    it('sends POST with decision payload', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.approvals.submitDecision({
        approvalId: 'appr-1',
        decision: 'Approved',
        reason: 'Looks good',
      });

      const [url, options] = getCallArgs(fetchFn);
      expect(url).toContain('/approvals/appr-1/decision');
      const body = JSON.parse(options.body as string) as { decision: string; reason: string };
      expect(body.decision).toBe('Approved');
      expect(body.reason).toBe('Looks good');
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
});
