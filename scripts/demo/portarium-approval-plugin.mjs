/**
 * Portarium Approval Plugin — reusable approval-wait loop helper
 *
 * Implements the H7 (companion CLI) mechanism: REST polling with indefinite wait.
 * Agents import this to handle `awaiting_approval` responses from the proxy.
 *
 * Supports two backends:
 *   1. Demo proxy (default):  polls GET /approvals/:id (lowercase status)
 *   2. Real control plane:    polls GET /v1/workspaces/:wsId/approvals/:id (PascalCase status)
 *
 * @example Demo proxy mode (default)
 *   import { waitForApproval } from './portarium-approval-plugin.mjs';
 *   const result = await waitForApproval(approvalId, 'http://localhost:9999');
 *
 * @example Control plane mode
 *   import { waitForApproval } from './portarium-approval-plugin.mjs';
 *   const result = await waitForApproval(approvalId, 'http://localhost:9999', {
 *     controlPlane: {
 *       url: 'http://localhost:4400',
 *       workspaceId: 'ws-001',
 *       bearerToken: 'tok_xxx',
 *     },
 *   });
 */

import { get, request } from 'node:http';

// ---------------------------------------------------------------------------
// Status normalisation — real API uses PascalCase, demo proxy uses lowercase
// ---------------------------------------------------------------------------

/**
 * @param {string} status
 * @returns {'pending' | 'approved' | 'denied'}
 */
function normaliseStatus(status) {
  const lower = status.toLowerCase();
  if (lower === 'pending') return 'pending';
  if (lower === 'approved') return 'approved';
  // Treat 'denied' and 'requestchanges' as denied
  return 'denied';
}

// ---------------------------------------------------------------------------
// Core polling helper
// ---------------------------------------------------------------------------

/**
 * @typedef {{ url: string; workspaceId: string; bearerToken: string }} ControlPlaneConfig
 */

/**
 * Poll an approval endpoint until the approval is decided.
 *
 * When `opts.controlPlane` is set, polls the real control plane API:
 *   GET {controlPlane.url}/v1/workspaces/{workspaceId}/approvals/{approvalId}
 * Otherwise falls back to the demo proxy:
 *   GET {proxyUrl}/approvals/{approvalId}
 *
 * @param {string} approvalId
 * @param {string} proxyUrl   - e.g. "http://localhost:9999" (used when no controlPlane)
 * @param {{ timeout?: number; pollInterval?: number; controlPlane?: ControlPlaneConfig }} [opts]
 *   - timeout: milliseconds before giving up (default: Infinity — waits indefinitely)
 *   - pollInterval: milliseconds between polls (default: 2000)
 *   - controlPlane: when set, polls real control plane instead of demo proxy
 * @returns {Promise<{ approved: boolean; approvalId: string; decidedAt: string }>}
 */
export async function waitForApproval(approvalId, proxyUrl, opts = {}) {
  const { timeout = Infinity, pollInterval = 2000, controlPlane } = opts;
  const deadline = timeout === Infinity ? Infinity : Date.now() + timeout;

  while (true) {
    const record = controlPlane
      ? await getApprovalFromControlPlane(approvalId, controlPlane)
      : await getApprovalFromProxy(approvalId, proxyUrl);

    const status = normaliseStatus(record.status);

    if (status === 'approved') {
      return {
        approved: true,
        approvalId,
        decidedAt: record.decidedAtIso ?? record.decidedAt ?? new Date().toISOString(),
      };
    }
    if (status === 'denied') {
      return {
        approved: false,
        approvalId,
        decidedAt: record.decidedAtIso ?? record.decidedAt ?? new Date().toISOString(),
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
 * @param {{ timeout?: number; pollInterval?: number; controlPlane?: ControlPlaneConfig }} [opts]
 * @returns {Promise<{ approved: boolean; approvalId: string; decidedAt: string }>}
 */
export async function handleApprovalRequired(proxyResponse, proxyUrl, opts = {}) {
  const { approvalId, toolName } = proxyResponse;
  const cp = opts.controlPlane;

  console.log(`\n[approval] Tool "${toolName}" requires human approval.`);
  console.log(`[approval] Approval ID: ${approvalId}`);

  if (cp) {
    const decideUrl = `${cp.url}/v1/workspaces/${cp.workspaceId}/approvals/${approvalId}/decide`;
    console.log(`[approval] Control plane: ${cp.url}`);
    console.log(`[approval] To approve/deny, run in another terminal:`);
    console.log(
      `[approval]   npm run demo:approve -- --control-plane ${cp.url} --workspace-id ${cp.workspaceId} --bearer-token <token>`,
    );
    console.log(`[approval] Or use curl:`);
    console.log(
      `[approval]   curl -X POST ${decideUrl} -H 'Content-Type: application/json' -H 'Authorization: Bearer ${cp.bearerToken}' -d '{"decision":"Approved","rationale":"operator approved"}'`,
    );
  } else {
    console.log(`[approval] To approve/deny, run in another terminal:`);
    console.log(`[approval]   npm run demo:approve`);
    console.log(`[approval] Or visit: ${proxyUrl}/approvals/ui`);
    console.log(`[approval] Or use curl:`);
    console.log(
      `[approval]   curl -X POST ${proxyUrl}/approvals/${approvalId}/decide -H 'Content-Type: application/json' -d '{"decision":"approved"}'`,
    );
  }
  console.log(`[approval] Waiting indefinitely for human decision...\n`);

  const decision = await waitForApproval(approvalId, proxyUrl, opts);

  if (decision.approved) {
    console.log(`[approval] Approved at ${decision.decidedAt}`);
  } else {
    console.log(`[approval] Denied at ${decision.decidedAt}`);
  }

  return decision;
}

// ---------------------------------------------------------------------------
// Control plane HTTP helper
// ---------------------------------------------------------------------------

/**
 * Fetch approval status from the real control plane.
 *
 * @param {string} approvalId
 * @param {ControlPlaneConfig} controlPlane
 * @returns {Promise<{ status: string; decidedAtIso?: string }>}
 */
function getApprovalFromControlPlane(approvalId, controlPlane) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `/v1/workspaces/${controlPlane.workspaceId}/approvals/${approvalId}`,
      controlPlane.url,
    );
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${controlPlane.bearerToken}`,
        Accept: 'application/json',
      },
    };
    get(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const data = /** @type {any} */ (JSON.parse(raw));
          if (res.statusCode === 404) {
            reject(new Error(`Approval ${approvalId} not found on control plane`));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Control plane returned ${res.statusCode}: ${raw}`));
            return;
          }
          resolve(data);
        } catch (e) {
          reject(new Error(`Failed to parse control plane response: ${String(e)}`));
        }
      });
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Demo proxy HTTP helper (legacy)
// ---------------------------------------------------------------------------

/**
 * @param {string} approvalId
 * @param {string} proxyUrl
 * @returns {Promise<{ status: string; decidedAt?: string }>}
 */
function getApprovalFromProxy(approvalId, proxyUrl) {
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

// ---------------------------------------------------------------------------
// Propose helper — calls the real control plane proposeAgentAction endpoint
// ---------------------------------------------------------------------------

/**
 * Propose an agent action via the real control plane.
 *
 * POST {controlPlane.url}/v1/workspaces/{workspaceId}/agent-actions:propose
 *
 * @param {ControlPlaneConfig} controlPlane
 * @param {{ agentId: string; actionKind: string; toolName: string; executionTier: string; policyIds: string[]; rationale: string; parameters?: Record<string, unknown>; machineId?: string; idempotencyKey?: string }} input
 * @returns {Promise<{ decision: string; proposalId: string; approvalId?: string; evidenceId?: string; message?: string }>}
 */
export function proposeAgentAction(controlPlane, input) {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `/v1/workspaces/${controlPlane.workspaceId}/agent-actions:propose`,
      controlPlane.url,
    );
    const body = JSON.stringify(input);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${controlPlane.bearerToken}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const data = /** @type {any} */ (JSON.parse(raw));
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `proposeAgentAction failed (${res.statusCode}): ${data.detail ?? data.message ?? raw}`,
              ),
            );
            return;
          }
          resolve(data);
        } catch (e) {
          reject(new Error(`Failed to parse proposeAgentAction response: ${String(e)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
