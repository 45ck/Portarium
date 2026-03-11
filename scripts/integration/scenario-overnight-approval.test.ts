/**
 * Scenario: Overnight approval durability (ADR-0117).
 *
 * Validates the core ADR-0117 promise: an agent can propose an action,
 * wait indefinitely while the proxy stays live, and execute successfully
 * once a human approves — even after significant delay.
 *
 * Uses startPolicyProxy(0) with in-memory stores (no Postgres required).
 *
 * Scenarios:
 *   A. Delayed approve → re-invoke succeeds (simulates "approved 6h later")
 *   B. Multi-poll pending → eventually approved → execute (agent polls, doesn't timeout)
 *   C. waitForApproval plugin helper resolves after delayed human decision
 *   D. Denied approval → waitForApproval returns approved:false (not an error)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Scenario A — Delayed approval: proposal persists until human acts
// ---------------------------------------------------------------------------

describe('Scenario A — Delayed approval (simulates hours-later human action)', () => {
  let approvalId: string;

  it('Step 1: propose write:file → 202 awaiting_approval', async () => {
    const { status, body } = await invokeToolRaw('write:file', {
      path: '/tmp/overnight-test.txt',
      content: 'overnight-approval-test',
    });
    expect(status).toBe(202);
    expect(body['status']).toBe('awaiting_approval');
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: proposal is still pending after delay (durability)', async () => {
    await delay(50); // simulates time passing
    const { status, body } = await pollApproval(approvalId);
    expect(status).toBe(200);
    expect(body['status']).toBe('pending'); // hasn't expired
    expect(body['toolName']).toBe('write:file');
  });

  it('Step 3: human approves (overnight)', async () => {
    const { status, body } = await submitDecision(approvalId, 'approved');
    expect(status).toBe(200);
    expect(body['status']).toBe('approved');
    expect(typeof body['decidedAt']).toBe('string');
  });

  it('Step 4: agent resumes — re-invoke with approvalId → 200 executed', async () => {
    const { status, body } = await invokeToolRaw(
      'write:file',
      { path: '/tmp/overnight-test.txt', content: 'overnight-approval-test' },
      { approvalId },
    );
    expect(status).toBe(200);
    expect(body['allowed']).toBe(true);
    expect(body['approvedByHuman']).toBe(true);
    expect(body['approvalId']).toBe(approvalId);
  });
});

// ---------------------------------------------------------------------------
// Scenario B — Agent polls multiple times before approval
// ---------------------------------------------------------------------------

describe('Scenario B — Agent polls multiple times; approval arrives eventually', () => {
  let approvalId: string;

  it('Step 1: propose send:email → 202', async () => {
    const { status, body } = await invokeToolRaw('send:email', {
      to: 'cto@example.com',
      subject: 'Quarterly report',
    });
    expect(status).toBe(202);
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: poll 1 → still pending', async () => {
    const { body } = await pollApproval(approvalId);
    expect(body['status']).toBe('pending');
  });

  it('Step 3: poll 2 → still pending', async () => {
    await delay(20);
    const { body } = await pollApproval(approvalId);
    expect(body['status']).toBe('pending');
  });

  it('Step 4: approve', async () => {
    await submitDecision(approvalId, 'approved');
  });

  it('Step 5: poll 3 → now approved', async () => {
    const { body } = await pollApproval(approvalId);
    expect(body['status']).toBe('approved');
  });

  it('Step 6: execute → 200 with approvedByHuman', async () => {
    const { status, body } = await invokeToolRaw(
      'send:email',
      { to: 'cto@example.com', subject: 'Quarterly report' },
      { approvalId },
    );
    expect(status).toBe(200);
    expect(body['allowed']).toBe(true);
    expect(body['approvedByHuman']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scenario C — waitForApproval plugin helper resolves after delayed approval
// ---------------------------------------------------------------------------

describe('Scenario C — waitForApproval plugin helper resolves', () => {
  let approvalId: string;

  it('Step 1: propose write:file → get approvalId', async () => {
    const { body } = await invokeToolRaw('write:file', {
      path: '/tmp/wait-test.txt',
      content: 'wait-for-approval',
    });
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: waitForApproval resolves approved:true after human approves', async () => {
    // Approve after 30ms while waitForApproval is polling
    setTimeout(() => void submitDecision(approvalId, 'approved'), 30);

    const result = await waitForApproval(approvalId, proxyUrl, {
      pollInterval: 15,
      timeout: 5_000,
    });
    expect(result.approved).toBe(true);
    expect(result.approvalId).toBe(approvalId);
    expect(typeof result.decidedAt).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Scenario D — Denied approval returns approved:false (not an error)
// ---------------------------------------------------------------------------

describe('Scenario D — Denied approval: waitForApproval returns approved:false', () => {
  let approvalId: string;

  it('Step 1: propose write:file → get approvalId', async () => {
    const { body } = await invokeToolRaw('write:file', {
      path: '/tmp/denied-test.txt',
      content: 'denied',
    });
    approvalId = body['approvalId'] as string;
  });

  it('Step 2: waitForApproval returns approved:false on denial (no throw)', async () => {
    setTimeout(() => void submitDecision(approvalId, 'denied'), 30);

    const result = await waitForApproval(approvalId, proxyUrl, {
      pollInterval: 15,
      timeout: 5_000,
    });
    expect(result.approved).toBe(false);
    expect(result.approvalId).toBe(approvalId);
  });
});
