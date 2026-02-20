import { describe, it, expect, vi } from 'vitest';
import {
  PortariumClient,
  PortariumApiError,
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

      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toBe('https://api.portarium.test/v1/workspaces/ws-test/runs');
      expect(options.method).toBe('POST');
      expect(options.headers['authorization']).toBe('Bearer test-token');
      expect(options.headers['traceparent']).toBe('00-abc123-def456-01');
      expect(options.headers['tracestate']).toBe('portarium=v1');
      expect(options.headers['idempotency-key']).toBeDefined();
      expect(options.headers['x-correlation-id']).toBeDefined();
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
      const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toContain('/runs/run-1');
    });
  });

  describe('runs.cancel', () => {
    it('sends POST to the cancel endpoint', async () => {
      const fetchFn = mockFetch(204);
      const client = makeClient({ fetchFn });

      await client.runs.cancel('run-1');

      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
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

      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(url).toContain('/approvals/appr-1/decision');
      const body = JSON.parse(options.body);
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

      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
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
          json: () => Promise.resolve({ runId: 'run-1', workflowId: 'wf-1', status: 'Running', createdAtIso: '2026-02-21T00:00:00Z' }),
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

      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(options.headers['x-correlation-id']).toMatch(
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

      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
      expect(options.headers['authorization']).toBe('Bearer mtls-token');
      expect(options.headers['x-client-cert']).toBe('cert-pem');
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
  });
});
