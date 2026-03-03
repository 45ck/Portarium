/**
 * H8: In-process EventEmitter approval-wait loop
 *
 * Exports an `approvalBus` (EventEmitter) that proxy code can use to
 * request and resolve approvals without any HTTP round-trip.
 *
 * When a CRITICAL tool call arrives:
 *  1. Emit  approvalBus.emit('approval:required', { approvalId, toolName, parameters })
 *  2. Wait  approvalBus.once('approval:decision:<id>', callback) with 30 s timeout
 *  3. Return the decision to the caller
 *
 * Also exposes a tiny HTTP endpoint (POST /approvals/:id/decide) so that
 * external callers can trigger the decision event from outside.
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Shared approval bus
// ---------------------------------------------------------------------------

export const approvalBus = new EventEmitter();

// ---------------------------------------------------------------------------
// Core approval flow
// ---------------------------------------------------------------------------

const APPROVAL_TIMEOUT_MS = 30_000;

/**
 * Request approval for a tool call. Returns a promise that resolves when
 * a decision arrives on the bus (or rejects after timeout).
 *
 * @param {{ toolName: string; parameters: Record<string,unknown> }} call
 * @returns {Promise<{ decision: 'approved'|'denied'; reason?: string }>}
 */
export function requestApproval(call) {
  const approvalId = randomUUID();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      approvalBus.removeAllListeners(`approval:decision:${approvalId}`);
      reject(new Error(`Approval ${approvalId} timed out after ${APPROVAL_TIMEOUT_MS} ms`));
    }, APPROVAL_TIMEOUT_MS);

    approvalBus.once(`approval:decision:${approvalId}`, (decision) => {
      clearTimeout(timer);
      resolve(decision);
    });

    // Notify listeners that an approval is needed
    approvalBus.emit('approval:required', {
      approvalId,
      toolName: call.toolName,
      parameters: call.parameters,
    });
  });
}

// ---------------------------------------------------------------------------
// Optional HTTP bridge — lets external callers resolve decisions via REST
// ---------------------------------------------------------------------------

/**
 * Start a minimal HTTP server that accepts
 *   POST /approvals/:id/decide  { "decision": "approved"|"denied", "reason": "..." }
 *
 * @param {number} [port=0]
 * @returns {Promise<{ url: string; close: () => Promise<void> }>}
 */
export async function startDecisionServer(port = 0) {
  const server = createServer((req, res) => {
    const match = req.url?.match(/^\/approvals\/([^/]+)\/decide$/);
    if (req.method !== 'POST' || !match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const approvalId = match[1];
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        approvalBus.emit(`approval:decision:${approvalId}`, {
          decision: payload.decision,
          reason: payload.reason,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const addr = server.address();
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
