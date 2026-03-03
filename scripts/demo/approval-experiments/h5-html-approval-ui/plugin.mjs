/**
 * H5: HTML approval UI — Approval wait plugin
 *
 * Polls GET /approvals/:id until the status is no longer "pending".
 * The HTML UI is for humans; this plugin polls the same API programmatically.
 * Default interval: 1000ms. Default timeout: 30s.
 *
 * Usage:
 *   import { waitForApproval } from './plugin.mjs';
 *   const result = await waitForApproval(approvalId, 'http://localhost:9998');
 *   // result: { approved: boolean, status: 'approved' | 'denied' | 'timeout' }
 */

/**
 * Poll the approval endpoint until a decision is made or timeout expires.
 *
 * @param {string} approvalId   UUID of the pending approval
 * @param {string} proxyUrl     Base URL of the approval proxy (e.g. http://localhost:9998)
 * @param {{ intervalMs?: number; timeoutMs?: number }} [opts]
 * @returns {Promise<{ approved: boolean; status: 'approved' | 'denied' | 'timeout' }>}
 */
export async function waitForApproval(approvalId, proxyUrl, opts = {}) {
  const intervalMs = opts.intervalMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const endpoint = `${proxyUrl}/approvals/${approvalId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Poll failed: ${res.status} ${res.statusText}`);
    }

    const data = /** @type {{ status: string }} */ (await res.json());

    if (data.status === 'approved') {
      return { approved: true, status: /** @type {const} */ ('approved') };
    }
    if (data.status === 'denied') {
      return { approved: false, status: /** @type {const} */ ('denied') };
    }

    // Still pending — wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { approved: false, status: /** @type {const} */ ('timeout') };
}
