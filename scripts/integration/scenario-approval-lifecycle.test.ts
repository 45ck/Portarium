/**
 * Scenario: End-to-end approval lifecycle via the real policy proxy HTTP server.
 *
 * Starts `startPolicyProxy(0)` (dynamic port), makes real HTTP calls, and
 * verifies the full 202→poll→decide→retry cycle that agents experience.
 *
 * No real LLM calls or API keys needed — pure HTTP lifecycle testing.
 *
 * Scenarios:
 *   A. Approve flow (write:file → 202 → approve → retry with approvalId → 200)
 *   B. Deny flow (shell.exec → 202 → deny → retry → new 202)
 *   C. Safe tool (read:file → 200 immediately)
 *   D. Async polling (waitForApproval with delayed approval)
 *   E. Multi-agent isolation (two agents, approve one, other stays pending)
 *   F. Security: toolName mismatch (approvalId reuse across tools blocked)
 *   G. send:email lifecycle (the "2 AM email" use case)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Proxy + plugin are ESM .mjs files — dynamic import in beforeAll
// ---------------------------------------------------------------------------

let proxyUrl: string;
let closeProxy: () => void;
let waitForApproval: (
  approvalId: string,
  proxyUrl: string,
  opts?: { timeout?: number; pollInterval?: number },
) => Promise<{ approved: boolean; approvalId: string; decidedAt: string }>;

beforeAll(async () => {
  // @ts-expect-error — untyped .mjs demo module
  const proxyMod = await import('../demo/portarium-tool-proxy.mjs');
  // @ts-expect-error — untyped .mjs demo module
  const pluginMod = await import('../demo/portarium-approval-plugin.mjs');

  const handle = await proxyMod.startPolicyProxy(0);
  proxyUrl = handle.url;
  closeProxy = handle.close;
  waitForApproval = pluginMod.waitForApproval;
});

afterAll(() => {
  closeProxy?.();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function invokeToolRaw(
  toolName: string,
  parameters: Record<string, unknown> = {},
  opts: { policyTier?: string; approvalId?: string } = {},
) {
  const body: Record<string, unknown> = {
    toolName,
    parameters,
    policyTier: opts.policyTier ?? 'Auto',
  };
  if (opts.approvalId) body['approvalId'] = opts.approvalId;

  const resp = await fetch(`${proxyUrl}/tools/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: (await resp.json()) as Record<string, unknown> };
}

async function pollApproval(approvalId: string) {
  const resp = await fetch(`${proxyUrl}/approvals/${approvalId}`);
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

// ---------------------------------------------------------------------------
// Scenario A: Approve flow
// ---------------------------------------------------------------------------

describe('Scenario A — Approve flow (write:file)', () => {
  let approvalId: string;

  it('Step 1: invoke write:file at Auto → 202 awaiting_approval', async () => {
    const { status, body } = await invokeToolRaw('write:file', {
      path: 'output.txt',
      content: 'hello',
    });

    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    expect(body['toolName']).toBe('write:file');
    expect(typeof body['approvalId']).toBe('string');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: poll → pending', async () => {
    const { status, body } = await pollApproval(approvalId);
    expect(status).toBe(200);
    expect(body['status']).toBe('pending');
    expect(body['toolName']).toBe('write:file');
  });

  it('Step 3: approve', async () => {
    const { status, body } = await submitDecision(approvalId, 'approved');
    expect(status).toBe(200);
    expect(body['status']).toBe('approved');
    expect(typeof body['decidedAt']).toBe('string');
  });

  it('Step 4: poll → approved', async () => {
    const { status, body } = await pollApproval(approvalId);
    expect(status).toBe(200);
    expect(body['status']).toBe('approved');
  });

  it('Step 5: retry with approvalId → 200 with approvedByHuman', async () => {
    const { status, body } = await invokeToolRaw(
      'write:file',
      { path: 'output.txt', content: 'hello' },
      { approvalId },
    );

    expect(status).toBe(200);
    expect(body['allowed']).toBe(true);
    expect(body['approvedByHuman']).toBe(true);
    expect(body['approvalId']).toBe(approvalId);
    expect(body['tool']).toBe('write:file');
    expect(body['output']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Scenario B: Deny flow
// ---------------------------------------------------------------------------

describe('Scenario B — Deny flow (shell.exec)', () => {
  let approvalId: string;

  it('Step 1: invoke shell.exec at Auto → 202', async () => {
    const { status, body } = await invokeToolRaw('shell.exec', { command: 'rm -rf /' });
    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: deny', async () => {
    const { status, body } = await submitDecision(approvalId, 'denied');
    expect(status).toBe(200);
    expect(body['status']).toBe('denied');
  });

  it('Step 3: poll → denied', async () => {
    const { status, body } = await pollApproval(approvalId);
    expect(status).toBe(200);
    expect(body['status']).toBe('denied');
  });

  it('Step 4: retry with denied approvalId → new 202 (no bypass)', async () => {
    const { status, body } = await invokeToolRaw(
      'shell.exec',
      { command: 'rm -rf /' },
      { approvalId },
    );

    // Denied approvalId doesn't grant bypass — proxy falls through to normal policy → new 202
    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    // Gets a NEW approval ID, not the old denied one
    expect(body['approvalId']).not.toBe(approvalId);
  });
});

// ---------------------------------------------------------------------------
// Scenario C: Safe tool
// ---------------------------------------------------------------------------

describe('Scenario C — Safe tool (read:file → 200 immediately)', () => {
  it('read:file at Auto tier → 200 allowed', async () => {
    const { status, body } = await invokeToolRaw('read:file', { path: 'README.md' });

    expect(status).toBe(200);
    expect(body['allowed']).toBe(true);
    expect(body['decision']).toBe('Allow');
    expect(body['tool']).toBe('read:file');
    expect(body['output']).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Scenario D: Async polling (waitForApproval)
// ---------------------------------------------------------------------------

describe('Scenario D — Async polling via waitForApproval()', () => {
  it('waitForApproval resolves after delayed approval', async () => {
    // Create a pending approval
    const { body } = await invokeToolRaw('write:file', {
      path: 'delayed.txt',
      content: 'data',
    });
    const approvalId = body['approvalId'] as string;

    // Start polling with short interval
    const pollPromise = waitForApproval(approvalId, proxyUrl, {
      pollInterval: 50,
      timeout: 5000,
    });

    // Approve after a short delay
    await new Promise((r) => setTimeout(r, 150));
    await submitDecision(approvalId, 'approved');

    const result = await pollPromise;
    expect(result.approved).toBe(true);
    expect(result.approvalId).toBe(approvalId);
    expect(typeof result.decidedAt).toBe('string');
  });

  it('waitForApproval resolves with denied=false after denial', async () => {
    const { body } = await invokeToolRaw('shell.exec', { command: 'echo hi' });
    const approvalId = body['approvalId'] as string;

    const pollPromise = waitForApproval(approvalId, proxyUrl, {
      pollInterval: 50,
      timeout: 5000,
    });

    await new Promise((r) => setTimeout(r, 150));
    await submitDecision(approvalId, 'denied');

    const result = await pollPromise;
    expect(result.approved).toBe(false);
    expect(result.approvalId).toBe(approvalId);
  });
});

// ---------------------------------------------------------------------------
// Scenario E: Multi-agent isolation
// ---------------------------------------------------------------------------

describe('Scenario E — Multi-agent isolation', () => {
  it('approving agent1 does not affect agent2', async () => {
    // Agent 1: write:file
    const r1 = await invokeToolRaw('write:file', { path: 'a1.txt', content: 'a1' });
    const id1 = r1.body['approvalId'] as string;

    // Agent 2: write:file (separate invocation)
    const r2 = await invokeToolRaw('write:file', { path: 'a2.txt', content: 'a2' });
    const id2 = r2.body['approvalId'] as string;

    // They must get different approval IDs
    expect(id1).not.toBe(id2);

    // Approve agent 1 only
    await submitDecision(id1, 'approved');

    // Agent 1: approved
    const poll1 = await pollApproval(id1);
    expect(poll1.body['status']).toBe('approved');

    // Agent 2: still pending
    const poll2 = await pollApproval(id2);
    expect(poll2.body['status']).toBe('pending');

    // Agent 1 can execute
    const retry1 = await invokeToolRaw(
      'write:file',
      { path: 'a1.txt', content: 'a1' },
      { approvalId: id1 },
    );
    expect(retry1.status).toBe(200);
    expect(retry1.body['approvedByHuman']).toBe(true);

    // Agent 2 cannot use agent 1's approvalId — toolName matches but id2 is still pending
    const retry2 = await invokeToolRaw(
      'write:file',
      { path: 'a2.txt', content: 'a2' },
      { approvalId: id2 },
    );
    expect(retry2.status).toBe(202); // id2 is pending, not approved → falls through to new 202
  });
});

// ---------------------------------------------------------------------------
// Scenario F: Security — toolName mismatch
// ---------------------------------------------------------------------------

describe('Scenario F — Security: approvalId cannot be reused across tools', () => {
  it('approved write:file approvalId cannot bypass policy for shell.exec', async () => {
    // Get a write:file approval
    const { body } = await invokeToolRaw('write:file', { path: 'sec.txt', content: 'x' });
    const approvalId = body['approvalId'] as string;

    // Approve it
    await submitDecision(approvalId, 'approved');

    // Try to use the write:file approvalId for shell.exec
    const { status, body: retryBody } = await invokeToolRaw(
      'shell.exec',
      { command: 'malicious' },
      { approvalId },
    );

    // Proxy checks approval.toolName === request toolName — mismatch → falls through → new 202
    expect(status).toBe(202);
    expect(retryBody['status']).toBe('awaiting_approval');
    expect(retryBody['approvalId']).not.toBe(approvalId);
  });
});

// ---------------------------------------------------------------------------
// Scenario G: send:email lifecycle (the "2 AM email" use case)
// ---------------------------------------------------------------------------

describe('Scenario G — send:email lifecycle', () => {
  let approvalId: string;

  it('Step 1: send:email at Auto → 202 (mutation tool)', async () => {
    const { status, body } = await invokeToolRaw('send:email', {
      to: 'boss@example.com',
      subject: 'Late night report',
      body: 'Here are the numbers.',
    });

    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    expect(body['toolName']).toBe('send:email');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: approval is visible in GET /approvals?status=pending', async () => {
    const resp = await fetch(`${proxyUrl}/approvals?status=pending`);
    const data = (await resp.json()) as { approvals: { approvalId: string; toolName: string }[] };
    const match = data.approvals.find((a) => a.approvalId === approvalId);
    expect(match).toBeTruthy();
    expect(match!.toolName).toBe('send:email');
  });

  it('Step 3: approve → retry → email executes', async () => {
    await submitDecision(approvalId, 'approved');

    const { status, body } = await invokeToolRaw(
      'send:email',
      { to: 'boss@example.com', subject: 'Late night report', body: 'Here are the numbers.' },
      { approvalId },
    );

    expect(status).toBe(200);
    expect(body['allowed']).toBe(true);
    expect(body['approvedByHuman']).toBe(true);
    expect(body['tool']).toBe('send:email');
  });
});
