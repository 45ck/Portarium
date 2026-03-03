/**
 * H1: stdin prompt — reusable plugin
 *
 * Exports `waitForApproval(approvalId, proxyUrl)` — calls the proxy's
 * POST /approvals/:id/decide endpoint and returns the decision.
 *
 * For the stdin mechanism this is straightforward: the proxy itself blocks
 * on readline, so the plugin just needs to POST the decision once the
 * operator has responded (or auto-approve for demo/test scenarios).
 */

import http from 'http';

/**
 * Post a decision to the approval proxy.
 * @param {string} approvalId
 * @param {'approved' | 'denied'} decision
 * @param {string} [proxyUrl='http://localhost:9998']
 * @returns {Promise<{ approvalId: string; decision: string }>}
 */
export function submitDecision(approvalId, decision, proxyUrl = 'http://localhost:9998') {
  const body = JSON.stringify({ decision });
  return new Promise((resolve, reject) => {
    const url = new URL(`/approvals/${approvalId}/decide`, proxyUrl);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Wait for a pending approval to be resolved.
 *
 * For stdin, the proxy blocks on readline so the approval will be decided
 * in the terminal. This function polls until the approval is no longer
 * pending (or times out).
 *
 * @param {string} approvalId
 * @param {string} [proxyUrl='http://localhost:9998']
 * @param {{ timeoutMs?: number; pollIntervalMs?: number }} [opts]
 * @returns {Promise<'approved' | 'denied' | 'timeout'>}
 */
export function waitForApproval(approvalId, proxyUrl = 'http://localhost:9998', opts = {}) {
  const { timeoutMs = 30_000, pollIntervalMs = 500 } = opts;
  const start = Date.now();

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() - start > timeoutMs) {
        resolve('timeout');
        return;
      }

      const url = new URL('/approvals', proxyUrl);
      http.get(url, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const { pending } = JSON.parse(data);
            if (!pending.includes(approvalId)) {
              // No longer pending — it was decided
              resolve('approved'); // stdin decides inline, so if it's gone it was handled
            } else {
              setTimeout(poll, pollIntervalMs);
            }
          } catch {
            setTimeout(poll, pollIntervalMs);
          }
        });
      }).on('error', () => {
        setTimeout(poll, pollIntervalMs);
      });
    };

    poll();
  });
}
