import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CockpitApiError,
  ControlPlaneClient,
  controlPlaneClient,
  setControlPlaneAuthFailureHandler,
} from '@/lib/control-plane-client';

describe('ControlPlaneClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the decide endpoint and injects bearer auth', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ approvalId: 'ap-1', status: 'Approved' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      getBearerToken: () => 'token-123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.decideApproval('ws-1', 'ap-1', {
      decision: 'Approved',
      rationale: 'Looks good.',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('https://api.example.test/v1/workspaces/ws-1/approvals/ap-1/decide');
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('X-Portarium-Request')).toBe('1');
    expect(init.credentials).toBe('omit');
  });

  it('fetches cockpit extension context with bearer auth', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId: 'ws-1',
            principalId: 'user-1',
            availablePersonas: ['Operator'],
            availableCapabilities: ['objects:read'],
            availableApiScopes: ['extensions.read'],
            activePackIds: [],
            quarantinedExtensionIds: [],
            issuedAtIso: '2026-04-30T02:00:00.000Z',
            expiresAtIso: '2026-04-30T02:05:00.000Z',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      getBearerToken: () => 'token-123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.getCockpitExtensionContext('workspace with spaces');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe(
      'https://api.example.test/v1/workspaces/workspace%20with%20spaces/cockpit/extension-context',
    );
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(init.credentials).toBe('omit');
  });

  it('normalizes problem+json responses into CockpitApiError', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            type: 'https://example.test/problems/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: 'Missing policy scope',
            instance: '/v1/workspaces/ws-1/runs/run-1/cancel',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
    );
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.cancelRun('ws-1', 'run-1')).rejects.toBeInstanceOf(CockpitApiError);
    await expect(client.cancelRun('ws-1', 'run-1')).rejects.toMatchObject({
      status: 403,
      problem: { title: 'Forbidden' },
    });
  });

  it('retries transient status codes with backoff', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const pending = client.listApprovals('ws-1');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ items: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry mutating requests without an idempotency key', async () => {
    const fetchImpl = vi.fn(async () => new Response('busy', { status: 503 }));
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.cancelRun('ws-1', 'run-1')).rejects.toBeInstanceOf(CockpitApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries mutating requests when an idempotency key is provided', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ approvalId: 'ap-1', status: 'Approved' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const pending = client.decideApproval(
      'ws-1',
      'ap-1',
      { decision: 'Approved', rationale: 'Reviewed.' },
      { idempotencyKey: 'decision-1' },
    );
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ approvalId: 'ap-1' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries network failures for reads', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const pending = client.listRuns('ws-1');
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ items: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('notifies the auth-failure handler before throwing a 401 response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
          status: 401,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
    );
    const handler = vi.fn();
    setControlPlaneAuthFailureHandler(handler);
    const client = new ControlPlaneClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    try {
      await expect(client.listRuns('ws-1')).rejects.toBeInstanceOf(CockpitApiError);
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      setControlPlaneAuthFailureHandler(null);
    }
  });

  it('exports a singleton client for hooks/routes', () => {
    expect(controlPlaneClient).toBeInstanceOf(ControlPlaneClient);
  });

  it('uses cookie credentials when no bearer token is available', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      getBearerToken: () => undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.listRuns('ws-1');

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has('Authorization')).toBe(false);
    expect(init.credentials).toBe('include');
  });

  it('posts startRun using only the canonical request shape', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            runId: 'run-1',
            workspaceId: 'ws-1',
            workflowId: 'wf-1',
            correlationId: 'corr-1',
            executionTier: 'HumanApprove',
            initiatedByUserId: 'user-1',
            status: 'Pending',
            createdAtIso: '2026-04-30T02:00:00.000Z',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.startRun('ws-1', {
      workflowId: 'wf-1',
      parameters: { mode: 'dry-run' },
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/workspaces/ws-1/runs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      workflowId: 'wf-1',
      parameters: { mode: 'dry-run' },
    });
  });

  it('creates approvals against the canonical approvals endpoint', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            approvalId: 'ap-1',
            workspaceId: 'ws-1',
            runId: 'run-1',
            planId: 'plan-1',
            prompt: 'Approve this run',
            status: 'Pending',
            requestedAtIso: '2026-04-30T02:00:00.000Z',
            requestedByUserId: 'user-1',
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      getBearerToken: () => 'token-123',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.createApproval('ws-1', {
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve this run',
      dueAtIso: '2026-05-01T02:00:00.000Z',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('https://api.example.test/v1/workspaces/ws-1/approvals');
    expect(init.method).toBe('POST');
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('X-Portarium-Request')).toBe('1');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(String(init.body))).toEqual({
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Approve this run',
      dueAtIso: '2026-05-01T02:00:00.000Z',
    });
  });

  it('posts natural language intents to the plan endpoint', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            intent: { intentId: 'intent-1' },
            plan: { planId: 'plan-1' },
            proposals: [],
            artifact: { markdown: '# Plan' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.planIntent('ws-1', {
      triggerText: 'Build approval queue summary',
      source: 'Human',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/workspaces/ws-1/intents:plan');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      triggerText: 'Build approval queue summary',
      source: 'Human',
    });
  });

  it('posts typed run interventions to the run endpoint', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ runId: 'run-1', status: 'Paused' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.submitRunIntervention('ws-1', 'run-1', {
      interventionType: 'pause',
      rationale: 'Need finance context before continuing.',
      effect: 'current-run-effect',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/v1/workspaces/ws-1/runs/run-1/interventions');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      interventionType: 'pause',
      rationale: 'Need finance context before continuing.',
      effect: 'current-run-effect',
    });
  });

  it('URL-encodes workspace and resource path segments', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ approvalId: 'ap/1', status: 'Pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.getApproval('workspace with spaces', 'ap/1');

    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.test/v1/workspaces/workspace%20with%20spaces/approvals/ap%2F1',
    );
  });

  it('builds work-item list filters with cursor pagination', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [], nextCursor: 'next' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.listWorkItems('ws-1', {
      status: 'Blocked',
      ownerUserId: 'user-1',
      runId: 'run-1',
      workflowId: 'wf-1',
      approvalId: 'ap-1',
      evidenceId: 'ev-1',
      limit: 25,
      cursor: 'cursor:1',
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/v1/workspaces/ws-1/work-items');
    expect(parsed.searchParams.get('status')).toBe('Blocked');
    expect(parsed.searchParams.get('ownerUserId')).toBe('user-1');
    expect(parsed.searchParams.get('runId')).toBe('run-1');
    expect(parsed.searchParams.get('workflowId')).toBe('wf-1');
    expect(parsed.searchParams.get('approvalId')).toBe('ap-1');
    expect(parsed.searchParams.get('evidenceId')).toBe('ev-1');
    expect(parsed.searchParams.get('limit')).toBe('25');
    expect(parsed.searchParams.get('cursor')).toBe('cursor:1');
    expect(init.method).toBeUndefined();
  });

  it('builds plan, evidence, and run evidence endpoints', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.getPlan('workspace with spaces', 'plan/1');
    await client.listEvidence('ws-1', {
      runId: 'run-1',
      planId: 'plan-1',
      workItemId: 'wi-1',
      category: 'Approval',
      limit: 50,
      cursor: 'next:ev',
    });
    await client.listRunEvidence('ws-1', 'run/1', {
      limit: 10,
      cursor: 'next:run-ev',
    });

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const planUrl = new URL(calls[0]![0]);
    const evidenceUrl = new URL(calls[1]![0]);
    const runEvidenceUrl = new URL(calls[2]![0]);

    expect(planUrl.pathname).toBe('/v1/workspaces/workspace%20with%20spaces/plans/plan%2F1');
    expect(evidenceUrl.pathname).toBe('/v1/workspaces/ws-1/evidence');
    expect(evidenceUrl.searchParams.get('runId')).toBe('run-1');
    expect(evidenceUrl.searchParams.get('planId')).toBe('plan-1');
    expect(evidenceUrl.searchParams.get('workItemId')).toBe('wi-1');
    expect(evidenceUrl.searchParams.get('category')).toBe('Approval');
    expect(evidenceUrl.searchParams.get('limit')).toBe('50');
    expect(evidenceUrl.searchParams.get('cursor')).toBe('next:ev');
    expect(runEvidenceUrl.pathname).toBe('/v1/workspaces/ws-1/runs/run%2F1/evidence');
    expect(runEvidenceUrl.searchParams.get('limit')).toBe('10');
    expect(runEvidenceUrl.searchParams.get('cursor')).toBe('next:run-ev');
  });
});
