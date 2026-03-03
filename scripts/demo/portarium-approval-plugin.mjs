/**
 * Portarium Approval Plugin — reusable approval-wait loop helper
 *
 * Implements the H7 (companion CLI) mechanism: REST polling with indefinite wait.
 * Agents import this to handle `awaiting_approval` responses from the proxy.
 *
 * @example
 *   import { handleApprovalRequired } from './portarium-approval-plugin.mjs';
 *
 *   const result = await fetch(`${proxyUrl}/tools/invoke`, { method:'POST', ... });
 *   const body = await result.json();
 *
 *   if (body.status === 'awaiting_approval') {
 *     const decision = await handleApprovalRequired(body, proxyUrl);
 *     if (decision.approved) {
 *       // re-invoke with approvalId
 *     }
 *   }
 */

import { get } from 'node:http';

// ---------------------------------------------------------------------------
// Core polling helper
// ---------------------------------------------------------------------------

/**
 * Poll `GET /approvals/:id` until the approval is decided.
 *
 * @param {string} approvalId
 * @param {string} proxyUrl   - e.g. "http://localhost:9999"
 * @param {{ timeout?: number; pollInterval?: number }} [opts]
 *   - timeout: milliseconds before giving up (default: Infinity — waits indefinitely)
 *   - pollInterval: milliseconds between polls (default: 2000)
 * @returns {Promise<{ approved: boolean; approvalId: string; decidedAt: string }>}
 */
export async function waitForApproval(approvalId, proxyUrl, opts = {}) {
  const { timeout = Infinity, pollInterval = 2000 } = opts;
  const deadline = timeout === Infinity ? Infinity : Date.now() + timeout;

  while (true) {
    const record = await getApproval(approvalId, proxyUrl);

    if (record.status === 'approved') {
      return {
        approved: true,
        approvalId,
        decidedAt: record.decidedAt ?? new Date().toISOString(),
      };
    }
    if (record.status === 'denied') {
      return {
        approved: false,
        approvalId,
        decidedAt: record.decidedAt ?? new Date().toISOString(),
      };
    }

    // Still pending — check timeout
    if (Date.now() >= deadline) {
      throw new Error(`[approval-plugin] Approval ${approvalId} timed out after ${timeout}ms`);
    }

    await sleep(pollInterval);
  }
}

// ---------------------------------------------------------------------------
// High-level integration helper
// ---------------------------------------------------------------------------

/**
 * Handle an `awaiting_approval` proxy response.
 * Prints instructions to the console and waits for a human decision.
 *
 * @param {{ status: string; approvalId: string; toolName: string; message?: string }} proxyResponse
 * @param {string} proxyUrl
 * @param {{ timeout?: number; pollInterval?: number }} [opts]
 * @returns {Promise<{ approved: boolean; approvalId: string; decidedAt: string }>}
 */
export async function handleApprovalRequired(proxyResponse, proxyUrl, opts = {}) {
  const { approvalId, toolName } = proxyResponse;

  console.log(`\n[approval] ⏳ Tool "${toolName}" requires human approval.`);
  console.log(`[approval] Approval ID: ${approvalId}`);
  console.log(`[approval] To approve/deny, run in another terminal:`);
  console.log(`[approval]   npm run demo:approve`);
  console.log(`[approval] Or visit: ${proxyUrl}/approvals/ui`);
  console.log(`[approval] Or use curl:`);
  console.log(
    `[approval]   curl -X POST ${proxyUrl}/approvals/${approvalId}/decide -H 'Content-Type: application/json' -d '{"decision":"approved"}'`,
  );
  console.log(`[approval] Waiting indefinitely for human decision...\n`);

  const decision = await waitForApproval(approvalId, proxyUrl, opts);

  if (decision.approved) {
    console.log(`[approval] ✅ Approved at ${decision.decidedAt}`);
  } else {
    console.log(`[approval] ❌ Denied at ${decision.decidedAt}`);
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Low-level HTTP helpers (stdlib only, no fetch required for Node < 18)
// ---------------------------------------------------------------------------

/**
 * @param {string} approvalId
 * @param {string} proxyUrl
 * @returns {Promise<{ status: string; decidedAt?: string }>}
 */
function getApproval(approvalId, proxyUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/approvals/${approvalId}`, proxyUrl);
    get(url.toString(), (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve(/** @type {any} */ (JSON.parse(raw)));
        } catch (e) {
          reject(new Error(`Failed to parse approval response: ${String(e)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
