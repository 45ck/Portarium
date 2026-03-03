/**
 * H10: Temporal Signal — Proxy Extension (DEMO MODE)
 *
 * Demonstrates what a Temporal-signal-based approval-wait loop would look like.
 * In production, each approval creates a Temporal workflow that blocks on a
 * signal (`approvalDecisionSignal`). The human approves via the Temporal UI or
 * an API call that sends the signal.
 *
 * This demo version simulates the Temporal workflow lifecycle with an in-memory
 * Promise/resolve map — no Temporal server required.
 *
 * Real Temporal wiring (commented below) would use:
 *   import { Client } from '@temporalio/client';
 *   const client = new Client();
 *   const handle = client.workflow.getHandle(workflowId);
 *   await handle.signal(approvalDecisionSignal, { decision });
 *
 * Usage:
 *   node scripts/demo/approval-experiments/h10-temporal-signal/proxy-extension.mjs
 */

import { createServer } from 'node:http';

// ---------------------------------------------------------------------------
// In-memory simulation of Temporal workflow signal delivery
// ---------------------------------------------------------------------------

/** @type {Map<string, { resolve: (v: any) => void, decision?: string, workflowId: string, signalName: string, createdAt: string, toolName: string }>} */
const pendingApprovals = new Map();

let approvalSeq = 0;

/**
 * Create a pending approval — simulates starting a Temporal workflow that
 * blocks on `condition(() => decision !== undefined)`.
 *
 * @param {{ toolName: string }} opts
 * @returns {{ approvalId: string, workflowId: string, promise: Promise<string> }}
 */
export function createApproval({ toolName }) {
  const approvalId = `appr-temporal-${++approvalSeq}`;
  const workflowId = `portarium-run-${approvalId}`;
  const signalName = 'approvalDecision';

  /** @type {(v: any) => void} */
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });

  pendingApprovals.set(approvalId, {
    // @ts-expect-error -- assigned in Promise constructor
    resolve,
    workflowId,
    signalName,
    createdAt: new Date().toISOString(),
    toolName,
  });

  console.log(
    `[h10-temporal] Approval ${approvalId} created — Temporal workflow ${workflowId} ` +
      `waiting for signal "${signalName}"`,
  );

  return { approvalId, workflowId, promise };
}

/**
 * Deliver a decision — simulates `handle.signal(approvalDecisionSignal, ...)`.
 *
 * @param {string} approvalId
 * @param {'Approved' | 'Denied'} decision
 * @returns {boolean}
 */
export function deliverDecision(approvalId, decision) {
  const entry = pendingApprovals.get(approvalId);
  if (!entry) return false;

  entry.decision = decision;
  entry.resolve(decision);
  pendingApprovals.delete(approvalId);

  console.log(
    `[h10-temporal] Signal "${entry.signalName}" delivered to workflow ${entry.workflowId}: ${decision}`,
  );
  return true;

  // --- Real Temporal implementation (requires running Temporal server) ---
  // import { Client } from '@temporalio/client';
  // const client = new Client();
  // const handle = client.workflow.getHandle(entry.workflowId);
  // await handle.signal('approvalDecision', { decision, approvalId });
}

/** List pending approvals (like querying Temporal for running workflows). */
export function listPending() {
  return [...pendingApprovals.entries()].map(([id, e]) => ({
    approvalId: id,
    workflowId: e.workflowId,
    signalName: e.signalName,
    toolName: e.toolName,
    createdAt: e.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// HTTP server — POST /approvals/:id/decide
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env['H10_PORT'] || '9810', 10);

/** @param {import('node:http').IncomingMessage} req */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // POST /approvals/:id/decide
  const decideMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decide$/);
  if (req.method === 'POST' && decideMatch) {
    const id = decideMatch[1];
    const body = /** @type {any} */ (await readBody(req));
    const decision = body.decision || 'Approved';

    const ok = deliverDecision(id, decision);
    res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ok ? { status: 'signal_delivered', decision } : { error: 'not_found' }));
    return;
  }

  // GET /approvals
  if (req.method === 'GET' && url.pathname === '/approvals') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ pending: listPending() }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

if (process.argv[1] && process.argv[1].includes('proxy-extension')) {
  server.listen(PORT, () => {
    console.log(`[h10-temporal] Proxy extension listening on http://localhost:${PORT}`);
    console.log(`[h10-temporal] POST /approvals/:id/decide  { "decision": "Approved" }`);
    console.log(`[h10-temporal] GET  /approvals              (list pending)`);
  });
}

export { server, PORT };
