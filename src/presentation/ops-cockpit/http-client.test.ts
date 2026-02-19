import { describe, expect, it } from 'vitest';

import { ControlPlaneClient, ControlPlaneClientError } from './http-client.js';
import { ProblemDetailsError } from './problem-details.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface RecordedCall {
  input: string;
  init: RequestInit;
}

function createJsonFetch(
  body: unknown,
  status = 200,
): {
  calls: RecordedCall[];
  fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];

  const fetchImpl = (async (input: unknown, init: RequestInit = {}) => {
    calls.push({ input: String(input), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;

  return { calls, fetchImpl };
}

function createErrorFetch(status: number, body: string): typeof fetch {
  return (async () =>
    ({
      ok: false,
      status,
      headers: new Headers(),
      text: async () => body,
    }) as Response) as typeof fetch;
}

function createEmptyFetch(status = 204): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status,
      headers: new Headers(),
      text: async () => '',
    }) as Response) as typeof fetch;
}

function makeClient(fetchImpl: typeof fetch, extra: object = {}): ControlPlaneClient {
  return new ControlPlaneClient({
    baseUrl: 'https://api.portarium.test',
    fetchImpl,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// Route construction (contract-aligned)
// ---------------------------------------------------------------------------

describe('ControlPlaneClient contract-aligned route construction', () => {
  it('builds listWorkItems with linkage filters and pagination params', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: null });
    const client = makeClient(fetchImpl);

    await client.listWorkItems('workspace-1', {
      status: 'Open',
      ownerUserId: 'user-1',
      runId: 'run-1',
      workflowId: 'wf-1',
      approvalId: 'approval-1',
      evidenceId: 'evi-1',
      limit: 120,
      cursor: 'next:abc',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const parsed = new URL(call.input);
    expect(parsed.pathname).toBe('/v1/workspaces/workspace-1/work-items');
    expect(parsed.searchParams.get('status')).toBe('Open');
    expect(parsed.searchParams.get('ownerUserId')).toBe('user-1');
    expect(parsed.searchParams.get('runId')).toBe('run-1');
    expect(parsed.searchParams.get('workflowId')).toBe('wf-1');
    expect(parsed.searchParams.get('approvalId')).toBe('approval-1');
    expect(parsed.searchParams.get('evidenceId')).toBe('evi-1');
    expect(parsed.searchParams.get('limit')).toBe('120');
    expect(parsed.searchParams.get('cursor')).toBe('next:abc');
    expect(call.init.method).toBe('GET');
  });

  it('builds approval decision endpoint against approvalId', async () => {
    const { calls, fetchImpl } = createJsonFetch({
      schemaVersion: 1,
      approvalId: 'approval-1',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'approve',
      status: 'Pending',
      requestedAtIso: '2026-01-01T00:00:00Z',
      requestedByUserId: 'user-1',
    });
    const client = makeClient(fetchImpl);

    await client.decideApproval('workspace-1', 'approval-1', {
      decision: 'Approved',
      rationale: 'Looks good',
      idempotencyKey: 'idem-1',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const parsed = new URL(call.input);
    expect(parsed.pathname).toBe('/v1/workspaces/workspace-1/approvals/approval-1/decide');
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Headers;
    expect(headers.get('Idempotency-Key')).toBe('idem-1');
    expect(JSON.parse(call.init.body as string)).toEqual({
      decision: 'Approved',
      rationale: 'Looks good',
    });
  });

  it('builds run evidence endpoint with run path and cursor pagination', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: 'next:1' });
    const client = makeClient(fetchImpl);

    await client.listRunEvidence('workspace-1', 'run-1', {
      limit: 25,
      cursor: 'prev:2',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const parsed = new URL(call.input);
    expect(parsed.pathname).toBe('/v1/workspaces/workspace-1/runs/run-1/evidence');
    expect(parsed.searchParams.get('limit')).toBe('25');
    expect(parsed.searchParams.get('cursor')).toBe('prev:2');
  });

  it('builds approval and plan resource paths correctly', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl);

    await client.listApprovals('workspace-1');
    await client.getPlan('workspace-1', 'plan-1');

    expect(calls).toHaveLength(2);
    const approvalsCall = calls[0]!;
    const planCall = calls[1]!;
    expect(new URL(approvalsCall.input).pathname).toBe('/v1/workspaces/workspace-1/approvals');
    expect(approvalsCall.init.method).toBe('GET');
    expect(new URL(planCall.input).pathname).toBe('/v1/workspaces/workspace-1/plans/plan-1');
    expect(planCall.init.method).toBe('GET');
  });

  it('passes body for createApproval with idempotency key', async () => {
    const { calls, fetchImpl } = createJsonFetch({
      schemaVersion: 1,
      approvalId: 'approval-2',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Need approval',
      status: 'Pending',
      requestedAtIso: '2026-01-01T00:00:00Z',
      requestedByUserId: 'user-1',
    });
    const client = makeClient(fetchImpl);

    await client.createApproval(
      'workspace-1',
      { runId: 'run-1', planId: 'plan-1', prompt: 'Need approval' },
      'idempotency-create',
    );

    const call = calls[0]!;
    expect(new URL(call.input).pathname).toBe('/v1/workspaces/workspace-1/approvals');
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Headers).get('Idempotency-Key')).toBe('idempotency-create');
    expect(JSON.parse(call.init.body as string)).toEqual({
      runId: 'run-1',
      planId: 'plan-1',
      prompt: 'Need approval',
    });
  });

  it('builds getRun, cancelRun, getWorkItem, updateWorkItem, getApproval routes', async () => {
    const { calls, fetchImpl } = createJsonFetch({ id: 'any' });
    const client = makeClient(fetchImpl);

    await client.getRun('ws', 'run-42');
    await client.cancelRun('ws', 'run-42');
    await client.getWorkItem('ws', 'wi-7');
    await client.updateWorkItem('ws', 'wi-7', { title: 'Updated' });
    await client.getApproval('ws', 'appr-9');

    const paths = calls.map((c) => new URL(c.input).pathname);
    expect(paths[0]).toBe('/v1/workspaces/ws/runs/run-42');
    expect(calls[0]!.init.method).toBe('GET');
    expect(paths[1]).toBe('/v1/workspaces/ws/runs/run-42/cancel');
    expect(calls[1]!.init.method).toBe('POST');
    expect(paths[2]).toBe('/v1/workspaces/ws/work-items/wi-7');
    expect(calls[2]!.init.method).toBe('GET');
    expect(paths[3]).toBe('/v1/workspaces/ws/work-items/wi-7');
    expect(calls[3]!.init.method).toBe('PATCH');
    expect(paths[4]).toBe('/v1/workspaces/ws/approvals/appr-9');
    expect(calls[4]!.init.method).toBe('GET');
  });

  it('builds listEvidence with all filter params', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: null });
    const client = makeClient(fetchImpl);

    await client.listEvidence('ws', {
      runId: 'run-1',
      planId: 'plan-1',
      workItemId: 'wi-1',
      category: 'Approval',
      limit: 50,
    });

    const search = new URL(calls[0]!.input).searchParams;
    expect(search.get('runId')).toBe('run-1');
    expect(search.get('planId')).toBe('plan-1');
    expect(search.get('workItemId')).toBe('wi-1');
    expect(search.get('category')).toBe('Approval');
    expect(search.get('limit')).toBe('50');
  });

  it('percent-encodes workspace IDs and resource IDs with special characters', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [] });
    const client = makeClient(fetchImpl);

    await client.listRuns('ws/with spaces');
    await client.getRun('ws', 'run/with spaces');

    expect(new URL(calls[0]!.input).pathname).toBe('/v1/workspaces/ws%2Fwith%20spaces/runs');
    expect(new URL(calls[1]!.input).pathname).toBe('/v1/workspaces/ws/runs/run%2Fwith%20spaces');
  });

  it('startRun sends idempotency key when provided', async () => {
    const { calls, fetchImpl } = createJsonFetch({ runId: 'r-1' });
    const client = makeClient(fetchImpl);

    await client.startRun('ws', { workflowId: 'wf-1' }, 'idem-start');

    const call = calls[0]!;
    expect(new URL(call.input).pathname).toBe('/v1/workspaces/ws/runs');
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Headers).get('Idempotency-Key')).toBe('idem-start');
  });

  it('startRun omits idempotency key when not provided', async () => {
    const { calls, fetchImpl } = createJsonFetch({ runId: 'r-1' });
    const client = makeClient(fetchImpl);

    await client.startRun('ws', { workflowId: 'wf-1' });

    expect((calls[0]!.init.headers as Headers).get('Idempotency-Key')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error response handling
// ---------------------------------------------------------------------------

describe('ControlPlaneClient error response handling', () => {
  it('throws ProblemDetailsError when server returns RFC 9457 Problem Details', async () => {
    const problem = {
      type: 'https://portarium.dev/problems/approval-not-found',
      title: 'Approval Not Found',
      status: 404,
      detail: 'No approval with id appr-99 found',
      instance: '/v1/workspaces/ws/approvals/appr-99',
    };
    const client = makeClient(createErrorFetch(404, JSON.stringify(problem)));

    const error = await client.getApproval('ws', 'appr-99').catch((e) => e);
    expect(error).toBeInstanceOf(ProblemDetailsError);
    expect((error as ProblemDetailsError).status).toBe(404);
    expect((error as ProblemDetailsError).problem.type).toBe(
      'https://portarium.dev/problems/approval-not-found',
    );
    expect((error as ProblemDetailsError).problem.detail).toBe('No approval with id appr-99 found');
  });

  it('throws ControlPlaneClientError for non-Problem Details 4xx responses', async () => {
    const client = makeClient(createErrorFetch(422, 'Unprocessable Entity'));

    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(422);
    expect((error as ControlPlaneClientError).body).toBe('Unprocessable Entity');
  });

  it('throws ControlPlaneClientError for 500 server errors', async () => {
    const client = makeClient(createErrorFetch(500, 'Internal Server Error'));

    const error = await client.listApprovals('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(500);
  });

  it('throws ControlPlaneClientError for empty 4xx body', async () => {
    const client = makeClient(createErrorFetch(403, ''));

    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).status).toBe(403);
    expect((error as ControlPlaneClientError).body).toBe('');
  });

  it('throws ControlPlaneClientError when response body is not valid JSON', async () => {
    // Use a fetch that returns malformed JSON (not parseable)
    const badFetch = (async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '{{bad json',
      }) as Response) as typeof fetch;
    const client = makeClient(badFetch);

    const error = await client.listRuns('ws').catch((e) => e);
    expect(error).toBeInstanceOf(ControlPlaneClientError);
    expect((error as ControlPlaneClientError).body).toBe('Invalid JSON response');
  });
});

// ---------------------------------------------------------------------------
// Response parsing edge cases
// ---------------------------------------------------------------------------

describe('ControlPlaneClient response parsing', () => {
  it('returns undefined for 204 No Content responses', async () => {
    const client = makeClient(createEmptyFetch(204));
    const result = await client.cancelRun('ws', 'run-1');
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty 200 body', async () => {
    const client = makeClient(createEmptyFetch(200));
    const result = await client.cancelRun('ws', 'run-1');
    expect(result).toBeUndefined();
  });

  it('passes response through parse function when provided', async () => {
    // Access via internal request — test through a public method that uses parse indirectly
    // Verify that valid JSON is correctly passed back as-is (default identity parse)
    const payload = { items: [{ id: 'wi-1' }], nextCursor: 'next:xyz' };
    const { fetchImpl } = createJsonFetch(payload);
    const client = makeClient(fetchImpl);

    const result = await client.listWorkItems('ws');
    expect(result).toEqual(payload);
  });
});

// Auth and timeout tests are in http-client-auth.test.ts (split for max-lines compliance)
