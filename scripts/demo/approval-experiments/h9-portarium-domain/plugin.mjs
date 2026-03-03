#!/usr/bin/env node
// H9: Portarium domain wiring — plugin
//
// Exports waitForApproval(approvalId, portariumApiBase) that polls the
// Portarium approval API until the approval transitions from Pending to
// a decided state (Approved / Denied / RequestChanges).
//
// This mirrors the real Portarium REST API shape:
//   GET {portariumApiBase}/api/approvals/:id
//
// For the demo, use proxy-extension.mjs as the mock API backend.

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Poll the Portarium approval API until a decision is made.
 *
 * @param {string} approvalId  — the approval ID returned by the proxy
 * @param {string} portariumApiBase — base URL of the Portarium API (e.g. http://localhost:9079)
 * @param {object} [options]
 * @param {number} [options.pollIntervalMs=1000] — polling interval
 * @param {number} [options.timeoutMs=300000] — max wait time
 * @param {AbortSignal} [options.signal] — optional abort signal
 * @returns {Promise<object>} — the decided approval object (ApprovalDecidedV1 shape)
 */
export async function waitForApproval(approvalId, portariumApiBase, options = {}) {
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = options.signal;

  const endpoint = `${portariumApiBase.replace(/\/$/, '')}/approvals/${approvalId}`;
  const deadline = Date.now() + timeout;

  // PRODUCTION WIRING: In a real Portarium deployment, this endpoint would be:
  //   GET /v1/workspaces/{workspaceId}/approvals/{approvalId}
  // with proper authentication headers (Bearer token or mTLS).
  //
  // A more efficient production approach would use:
  //   - SSE stream from /v1/workspaces/{workspaceId}/events?filter=Approval
  //   - Or WebSocket subscription to the CloudEvent bus
  //   - Or Temporal signal (if running inside a Temporal workflow)
  //
  // Polling is used here for maximum simplicity and compatibility.

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error(`Approval wait aborted for ${approvalId}`);
    }

    try {
      const res = await fetch(endpoint);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const approval = await res.json();

      if (approval.status !== 'Pending') {
        return approval;
      }
    } catch (err) {
      // Network errors during polling are expected (server might be starting up)
      if (Date.now() + pollInterval > deadline) {
        throw new Error(`Approval ${approvalId} timed out after ${timeout}ms: ${err.message}`);
      }
    }

    await sleep(pollInterval, signal);
  }

  throw new Error(`Approval ${approvalId} timed out after ${timeout}ms (still Pending)`);
}

/**
 * Create a new pending approval via the Portarium API.
 *
 * @param {string} portariumApiBase — base URL of the Portarium API
 * @param {object} payload — { prompt, workspaceId?, runId? }
 * @returns {Promise<object>} — the created ApprovalPendingV1 object
 */
export async function createApproval(portariumApiBase, payload) {
  const endpoint = `${portariumApiBase.replace(/\/$/, '')}/approvals`;

  // PRODUCTION WIRING: In real Portarium, approval creation happens inside
  // the ActionGatedToolInvoker or workflow orchestration layer:
  //   1. Agent proposes a tool action
  //   2. Policy evaluation flags it as requiring human approval
  //   3. CreateApproval command persists a Pending approval
  //   4. CloudEvent "ApprovalRequested" is emitted
  //   5. Cockpit UI surfaces it to the human reviewer

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to create approval: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Submit a decision on a pending approval.
 *
 * @param {string} approvalId
 * @param {string} portariumApiBase
 * @param {object} decision — { decision: 'Approved'|'Denied'|'RequestChanges', rationale }
 * @returns {Promise<object>} — the decided ApprovalDecidedV1 object
 */
export async function submitDecision(approvalId, portariumApiBase, decision) {
  const endpoint = `${portariumApiBase.replace(/\/$/, '')}/approvals/${approvalId}/decide`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision),
  });

  if (!res.ok) {
    throw new Error(`Failed to submit decision: HTTP ${res.status}`);
  }

  return res.json();
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      },
      { once: true },
    );
  });
}
