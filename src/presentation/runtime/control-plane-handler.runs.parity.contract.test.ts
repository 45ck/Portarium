import { describe, expect, it } from 'vitest';

import {
  cancelRunUrl,
  forbiddenAuthorization,
  runStoreNotFound,
  runStoreWithStatus,
  startRunUrl,
  startRuntimeParityServer,
  unauthorizedAuthentication,
  workflowStoreInactive,
  workflowStoreNotFound,
} from './control-plane-handler.runtime-parity.test-support.js';

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /runs parity', () => {
  it('returns 201 with the started run', async () => {
    await startRuntimeParityServer();

    const res = await postJson(startRunUrl(), {
      workflowId: 'wf-runtime-parity-1',
      parameters: { dryRun: true },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { runId: string; workflowId: string; status: string };
    expect(body.runId).toBeTruthy();
    expect(body.workflowId).toBe('wf-runtime-parity-1');
    expect(body.status).toBe('Pending');
  });

  it('returns 400 when the start-run body is not valid JSON', async () => {
    await startRuntimeParityServer();

    const res = await postJson(startRunUrl(), 'not-json');

    expect(res.status).toBe(400);
  });

  it('returns 401 when authentication fails', async () => {
    await startRuntimeParityServer({ authentication: unauthorizedAuthentication() });

    const res = await postJson(startRunUrl(), { workflowId: 'wf-runtime-parity-1' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when the caller cannot start runs', async () => {
    await startRuntimeParityServer({ authorization: forbiddenAuthorization() });

    const res = await postJson(startRunUrl(), { workflowId: 'wf-runtime-parity-1' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when the target workflow does not exist', async () => {
    await startRuntimeParityServer({ workflowStore: workflowStoreNotFound() });

    const res = await postJson(startRunUrl(), { workflowId: 'wf-missing' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when the workflow cannot be started in its current state', async () => {
    await startRuntimeParityServer({ workflowStore: workflowStoreInactive() });

    const res = await postJson(startRunUrl(), { workflowId: 'wf-runtime-parity-inactive' });

    expect(res.status).toBe(409);
  });

  it('returns 422 when the start-run payload is invalid', async () => {
    await startRuntimeParityServer();

    const res = await postJson(startRunUrl(), { unexpectedField: true });

    expect(res.status).toBe(422);
  });
});

describe('POST /runs/:runId/cancel parity', () => {
  it('returns 200 with the cancelled run', async () => {
    await startRuntimeParityServer({ runStore: runStoreWithStatus('Running') });

    const res = await fetch(cancelRunUrl(), { method: 'POST' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { runId: string; status: string };
    expect(body.runId).toBe('run-runtime-parity-1');
    expect(body.status).toBe('Cancelled');
  });

  it('returns 401 when authentication fails', async () => {
    await startRuntimeParityServer({ authentication: unauthorizedAuthentication() });

    const res = await fetch(cancelRunUrl(), { method: 'POST' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when the caller cannot cancel runs', async () => {
    await startRuntimeParityServer({ authorization: forbiddenAuthorization() });

    const res = await fetch(cancelRunUrl(), { method: 'POST' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when the run does not exist', async () => {
    await startRuntimeParityServer({ runStore: runStoreNotFound() });

    const res = await fetch(cancelRunUrl('run-missing'), { method: 'POST' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when the run is already terminal', async () => {
    await startRuntimeParityServer({ runStore: runStoreWithStatus('Failed') });

    const res = await fetch(cancelRunUrl(), { method: 'POST' });

    expect(res.status).toBe(409);
  });
});
