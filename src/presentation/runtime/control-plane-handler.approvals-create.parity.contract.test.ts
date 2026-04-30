import { describe, expect, it } from 'vitest';

import {
  createApprovalUrl,
  forbiddenAuthorization,
  startRuntimeParityServer,
  unauthorizedAuthentication,
} from './control-plane-handler.runtime-parity.test-support.js';

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /approvals parity', () => {
  it('returns 201 with the created approval', async () => {
    await startRuntimeParityServer();

    const res = await postJson(createApprovalUrl(), {
      runId: 'run-runtime-parity-1',
      planId: 'plan-runtime-parity-1',
      prompt: 'Approve the governed handoff.',
      assigneeUserId: 'approver-runtime-parity-1',
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { approvalId: string; status: string };
    expect(body.approvalId).toBeTruthy();
    expect(body.status).toBe('Pending');
  });

  it('returns 400 when the create-approval body is not valid JSON', async () => {
    await startRuntimeParityServer();

    const res = await postJson(createApprovalUrl(), 'not-json');

    expect(res.status).toBe(400);
  });

  it('returns 401 when authentication fails', async () => {
    await startRuntimeParityServer({ authentication: unauthorizedAuthentication() });

    const res = await postJson(createApprovalUrl(), {
      runId: 'run-runtime-parity-1',
      planId: 'plan-runtime-parity-1',
      prompt: 'Approve the governed handoff.',
    });

    expect(res.status).toBe(401);
  });

  it('returns 403 when the caller cannot create approvals', async () => {
    await startRuntimeParityServer({ authorization: forbiddenAuthorization() });

    const res = await postJson(createApprovalUrl(), {
      runId: 'run-runtime-parity-1',
      planId: 'plan-runtime-parity-1',
      prompt: 'Approve the governed handoff.',
    });

    expect(res.status).toBe(403);
  });

  it('returns 422 when the create-approval payload is invalid', async () => {
    await startRuntimeParityServer();

    const res = await postJson(createApprovalUrl(), {
      runId: 'run-runtime-parity-1',
      prompt: '',
      unexpectedField: true,
    });

    expect(res.status).toBe(422);
  });
});
