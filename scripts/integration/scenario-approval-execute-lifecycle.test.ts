/**
 * Scenario: propose → approve → execute lifecycle via the real policy proxy HTTP server.
 *
 * Tests the POST /approvals/:id/execute endpoint (added in bead-0930).
 * Starts `startPolicyProxy(0)` (dynamic port), makes real HTTP calls, and
 * verifies the full propose → approve → execute cycle.
 *
 * No real LLM calls or API keys needed — pure HTTP lifecycle testing.
 *
 * Scenarios:
 *   A. Approve then execute (write:file → 202 → approve → execute → 200 {status:'Executed'})
 *   B. Double-execute conflict (execute again → 409)
 *   C. Cannot execute a Denied approval (deny → execute → 409)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Proxy is an ESM .mjs file — dynamic import in beforeAll
// ---------------------------------------------------------------------------

let proxyUrl: string;
let closeProxy: () => void;

beforeAll(async () => {
  // @ts-expect-error — untyped .mjs demo module
  const proxyMod = await import('../demo/portarium-tool-proxy.mjs');

  const handle = await proxyMod.startPolicyProxy(0);
  proxyUrl = handle.url;
  closeProxy = handle.close;
});

afterAll(() => {
  closeProxy?.();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeToolRaw(toolName: string, parameters: Record<string, unknown> = {}) {
  const resp = await fetch(`${proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName, parameters, policyTier: 'Auto' }),
  });
  return { status: resp.status, body: (await resp.json()) as Record<string, unknown> };
}

async function submitDecision(approvalId: string, decision: 'approved' | 'denied') {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return { status: resp.status, body: (await resp.json()) as Record<string, unknown> };
}

async function executeApproval(approvalId: string) {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return { status: resp.status, body: (await resp.json()) as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Scenario A: Approve then execute
// ---------------------------------------------------------------------------

describe('Scenario A — approve then execute (write:file)', () => {
  let approvalId: string;

  it('Step 1: invoke write:file → 202 awaiting_approval', async () => {
    const { status, body } = await invokeToolRaw('write:file', {
      path: 'exec-test.txt',
      content: 'hello',
    });

    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    expect(body['toolName']).toBe('write:file');
    expect(typeof body['approvalId']).toBe('string');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: approve the pending approval', async () => {
    const { status, body } = await submitDecision(approvalId, 'approved');
    expect(status).toBe(200);
    expect(body['status']).toBe('approved');
  });

  it('Step 3: execute → 200 with status Executed', async () => {
    const { status, body } = await executeApproval(approvalId);

    expect(status).toBe(200);
    expect(body['status']).toBe('Executed');
    expect(body['approvalId']).toBe(approvalId);
    expect(body['toolName']).toBe('write:file');
    expect(body['output']).toBeTruthy();
    expect(typeof body['executedAt']).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Scenario B: Double-execute returns 409
// ---------------------------------------------------------------------------

describe('Scenario B — double-execute returns 409 Conflict', () => {
  let approvalId: string;

  beforeAll(async () => {
    // Set up an already-executed approval
    const { body: invokeBody } = await invokeToolRaw('write:file', {
      path: 'double-exec.txt',
      content: 'data',
    });
    approvalId = invokeBody['approvalId'] as string;

    await submitDecision(approvalId, 'approved');
    await executeApproval(approvalId); // first execute → sets status to 'Executed'
  });

  it('second execute on already-Executed approval → 409 Conflict', async () => {
    const { status, body } = await executeApproval(approvalId);

    expect(status).toBe(409);
    expect(typeof body['error']).toBe('string');
    expect(body['error']).toMatch(/Executed/);
  });
});

// ---------------------------------------------------------------------------
// Scenario C: Cannot execute a Denied approval
// ---------------------------------------------------------------------------

describe('Scenario C — cannot execute a Denied approval', () => {
  let approvalId: string;

  it('Step 1: invoke shell.exec → 202 awaiting_approval', async () => {
    const { status, body } = await invokeToolRaw('shell.exec', { command: 'echo test' });
    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: deny the approval', async () => {
    const { status, body } = await submitDecision(approvalId, 'denied');
    expect(status).toBe(200);
    expect(body['status']).toBe('denied');
  });

  it('Step 3: execute on Denied approval → 409 Conflict', async () => {
    const { status, body } = await executeApproval(approvalId);

    expect(status).toBe(409);
    expect(typeof body['error']).toBe('string');
    expect(body['error']).toMatch(/Denied/);
  });
});
