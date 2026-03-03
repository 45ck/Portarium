/**
 * H10: Temporal Signal — Plugin (agent-side approval waiter)
 *
 * Exports `waitForApproval(approvalId, proxyUrl)` that blocks until the
 * Temporal signal resolves the approval.
 *
 * DEMO MODE: Polls the proxy's in-memory map via HTTP.
 *
 * REAL MODE (commented): Would create a Temporal workflow and use
 * `condition(() => decision !== undefined)` inside the workflow to block
 * until the signal arrives. The agent SDK would call
 * `client.workflow.execute('approvalWorkflow', { workflowId })` and await
 * the result.
 *
 * Usage:
 *   import { waitForApproval } from './plugin.mjs';
 *   const decision = await waitForApproval('appr-temporal-1', 'http://localhost:9810');
 */

const POLL_INTERVAL_MS = parseInt(process.env['H10_POLL_MS'] || '500', 10);
const TIMEOUT_MS = parseInt(process.env['H10_TIMEOUT_MS'] || '30000', 10);

/**
 * Wait for an approval decision by polling the demo proxy.
 *
 * In a real Temporal integration the agent would not poll at all — it would
 * call `client.workflow.execute(...)` and Temporal would block the workflow
 * deterministically until the signal arrives.
 *
 * @param {string} approvalId
 * @param {string} proxyUrl - Base URL of the proxy extension
 * @returns {Promise<{ decision: string, elapsed: number }>}
 */
export async function waitForApproval(approvalId, proxyUrl) {
  const start = Date.now();
  const deadline = start + TIMEOUT_MS;

  // --- Real Temporal implementation (no polling needed) ---
  //
  // import { Client } from '@temporalio/client';
  // import { approvalWorkflow } from './workflows.js';
  //
  // const client = new Client();
  // const result = await client.workflow.execute(approvalWorkflow, {
  //   taskQueue: 'portarium-approvals',
  //   workflowId: `approval-${approvalId}`,
  //   args: [{ approvalId }],
  // });
  // return { decision: result.decision, elapsed: Date.now() - start };
  //
  // The workflow itself uses:
  //   const approvalDecisionSignal = defineSignal('approvalDecision');
  //   let decision;
  //   setHandler(approvalDecisionSignal, (payload) => { decision = payload; });
  //   await condition(() => decision !== undefined);
  //   return { decision: decision.decision };

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${proxyUrl}/approvals`);
      if (res.ok) {
        const { pending } = await res.json();
        const found = pending.find((a) => a.approvalId === approvalId);
        if (!found) {
          // Approval no longer pending — it was decided
          return { decision: 'Approved', elapsed: Date.now() - start };
        }
      }
    } catch {
      // Proxy not reachable — keep trying
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  return { decision: 'Timeout', elapsed: Date.now() - start };
}

/**
 * Request an approval from the proxy and wait for it.
 *
 * @param {{ toolName: string, proxyUrl: string }} opts
 * @returns {Promise<{ approvalId: string, decision: string, elapsed: number }>}
 */
export async function requestAndWaitForApproval({ toolName, proxyUrl }) {
  // Ask proxy to create the approval (simulates starting a Temporal workflow)
  const res = await fetch(`${proxyUrl}/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create approval: ${res.status}`);
  }

  const { approvalId } = await res.json();
  const result = await waitForApproval(approvalId, proxyUrl);
  return { approvalId, ...result };
}
