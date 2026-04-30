import { describe, expect, it, vi } from 'vitest';
import {
  CockpitApiError,
  ControlPlaneClient,
  controlPlaneClient,
} from '@/lib/control-plane-client';

describe('ControlPlaneClient', () => {
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

  it('exports a singleton client for hooks/routes', () => {
    expect(controlPlaneClient).toBeInstanceOf(ControlPlaneClient);
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
});
