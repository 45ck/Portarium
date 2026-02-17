import { describe, expect, it } from 'vitest';

import { ControlPlaneClient } from './http-client.js';

interface RecordedCall {
  input: string;
  init: RequestInit;
}

function createJsonFetch(body: unknown): {
  calls: RecordedCall[];
  fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];

  const fetchImpl = (async (input: unknown, init: RequestInit = {}) => {
    calls.push({
      input: String(input),
      init,
    });
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(body),
    } as Response;
  }) as typeof fetch;

  return { calls, fetchImpl };
}

describe('ControlPlaneClient contract-aligned route construction', () => {
  it('builds listWorkItems with status, owner, and pagination params', async () => {
    const { calls, fetchImpl } = createJsonFetch({ items: [], nextCursor: null });
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.portarium.test',
      fetchImpl,
    });

    await client.listWorkItems('workspace-1', {
      status: 'Open',
      ownerUserId: 'user-1',
      limit: 120,
      cursor: 'next:abc',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const parsed = new URL(call.input);
    expect(parsed.pathname).toBe('/v1/workspaces/workspace-1/work-items');
    expect(parsed.searchParams.get('status')).toBe('Open');
    expect(parsed.searchParams.get('ownerUserId')).toBe('user-1');
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
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.portarium.test',
      fetchImpl,
    });

    await client.decideApproval(
      'workspace-1',
      'approval-1',
      'Approved',
      'Looks good',
      'idem-1',
    );

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
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.portarium.test',
      fetchImpl,
    });

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
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.portarium.test',
      fetchImpl,
    });

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
    const client = new ControlPlaneClient({
      baseUrl: 'https://api.portarium.test',
      fetchImpl,
    });

    await client.createApproval(
      'workspace-1',
      {
        runId: 'run-1',
        planId: 'plan-1',
        prompt: 'Need approval',
      },
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
});
