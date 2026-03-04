#!/usr/bin/env node
/**
 * Portarium Approval CLI — npm run demo:approve
 *
 * Companion CLI for human operators. Polls for pending approvals and prompts
 * for approve/deny decisions.
 *
 * Supports two backends:
 *   1. Demo proxy (default): polls GET /approvals?status=pending on the local proxy
 *   2. Real control plane:   polls GET /v1/workspaces/:wsId/approvals?status=Pending
 *
 * Usage (demo proxy):
 *   npm run demo:approve
 *   PROXY_URL=http://localhost:9998 node scripts/demo/portarium-approval-cli.mjs
 *
 * Usage (real control plane):
 *   node scripts/demo/portarium-approval-cli.mjs \
 *     --control-plane http://localhost:4400 \
 *     --workspace-id ws-001 \
 *     --bearer-token tok_xxx
 *
 * Runs indefinitely — keeps waiting for new approvals until Ctrl+C.
 */

import { createInterface } from 'readline';
import { get, request } from 'http';
import { parseArgs } from 'node:util';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: cliArgs } = parseArgs({
  options: {
    'control-plane': { type: 'string' },
    'workspace-id': { type: 'string' },
    'bearer-token': { type: 'string' },
  },
  strict: false,
});

const PROXY_URL = process.env['PROXY_URL'] ?? 'http://localhost:9999';
const POLL_INTERVAL_MS = 2000;

/** @type {{ url: string; workspaceId: string; bearerToken: string } | null} */
const controlPlane =
  cliArgs['control-plane'] && cliArgs['workspace-id'] && cliArgs['bearer-token']
    ? {
        url: /** @type {string} */ (cliArgs['control-plane']),
        workspaceId: /** @type {string} */ (cliArgs['workspace-id']),
        bearerToken: /** @type {string} */ (cliArgs['bearer-token']),
      }
    : null;

// ---------------------------------------------------------------------------
// HTTP helpers — demo proxy backend
// ---------------------------------------------------------------------------

/** @returns {Promise<{ approvals: Array<{ approvalId: string; toolName: string; createdAt: string; status: string }> }>} */
function listPendingFromProxy() {
  return new Promise((resolve, reject) => {
    get(`${PROXY_URL}/approvals?status=pending`, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve(/** @type {any} */ (JSON.parse(raw)));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * @param {string} approvalId
 * @param {'approved'|'denied'} decision
 */
function postDecisionToProxy(approvalId, decision) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ decision });
    const url = new URL(`/approvals/${approvalId}/decide`, PROXY_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve(/** @type {any} */ (JSON.parse(raw)));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers — real control plane backend
// ---------------------------------------------------------------------------

/**
 * @param {{ url: string; workspaceId: string; bearerToken: string }} cp
 * @returns {Promise<{ items: Array<{ approvalId: string; prompt: string; requestedAtIso: string; status: string; requestedByUserId: string }> }>}
 */
function listPendingFromControlPlane(cp) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/v1/workspaces/${cp.workspaceId}/approvals?status=Pending`, cp.url);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cp.bearerToken}`,
        Accept: 'application/json',
      },
    };
    get(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const data = /** @type {any} */ (JSON.parse(raw));
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Control plane returned ${res.statusCode}: ${raw}`));
            return;
          }
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * @param {{ url: string; workspaceId: string; bearerToken: string }} cp
 * @param {string} approvalId
 * @param {'Approved'|'Denied'} decision
 * @param {string} rationale
 */
function postDecisionToControlPlane(cp, approvalId, decision, rationale) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ decision, rationale });
    const url = new URL(`/v1/workspaces/${cp.workspaceId}/approvals/${approvalId}/decide`, cp.url);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cp.bearerToken}`,
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
                `Control plane returned ${res.statusCode}: ${data.detail ?? data.message ?? raw}`,
              ),
            );
            return;
          }
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Unified pending approvals interface
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<Array<{ approvalId: string; label: string; createdAt: string }>>}
 */
async function fetchPending() {
  if (controlPlane) {
    const data = await listPendingFromControlPlane(controlPlane);
    return (data.items ?? []).map((a) => ({
      approvalId: a.approvalId,
      label: a.prompt ?? '(agent action)',
      createdAt: a.requestedAtIso ?? '',
    }));
  }
  const data = await listPendingFromProxy();
  return (data.approvals ?? []).map((a) => ({
    approvalId: a.approvalId,
    label: a.toolName ?? '(unknown)',
    createdAt: a.createdAt ?? '',
  }));
}

/**
 * @param {string} approvalId
 * @param {boolean} approved
 */
async function submitDecision(approvalId, approved) {
  if (controlPlane) {
    return postDecisionToControlPlane(
      controlPlane,
      approvalId,
      approved ? 'Approved' : 'Denied',
      approved ? 'Operator approved via CLI' : 'Operator denied via CLI',
    );
  }
  return postDecisionToProxy(approvalId, approved ? 'approved' : 'denied');
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// CLI interaction
// ---------------------------------------------------------------------------

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** @param {string} prompt */
function ask(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  const backend = controlPlane
    ? `control-plane: ${controlPlane.url} (workspace: ${controlPlane.workspaceId})`
    : `proxy: ${PROXY_URL}`;

  console.log('\n[demo:approve] Portarium Approval CLI');
  console.log(`[demo:approve] Backend: ${backend}`);
  console.log(`[demo:approve] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log('[demo:approve] Press Ctrl+C to exit.\n');

  // Wait for backend to be available
  let connected = false;
  while (!connected) {
    try {
      await fetchPending();
      connected = true;
    } catch {
      process.stdout.write('.');
      await sleep(1000);
    }
  }
  if (!connected) process.stdout.write('\n');
  console.log('[demo:approve] Connected.\n');

  let lastSeenCount = 0;

  while (true) {
    let pending;
    try {
      pending = await fetchPending();
    } catch {
      process.stdout.write('!');
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (pending.length === 0) {
      if (lastSeenCount > 0) {
        console.log('[demo:approve] No pending approvals. Waiting...');
      }
      lastSeenCount = 0;
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (pending.length !== lastSeenCount) {
      console.log(`\n[demo:approve] ${pending.length} pending approval(s):\n`);
      for (const [i, ap] of pending.entries()) {
        console.log(`  ${i + 1}. ${ap.label}`);
        console.log(`     ID:      ${ap.approvalId}`);
        console.log(`     Created: ${ap.createdAt}`);
      }
      console.log('');
    }
    lastSeenCount = pending.length;

    // Process the oldest pending approval
    const ap = pending[0];
    const answer = await ask(
      `[demo:approve] Approve "${ap.label}" (${ap.approvalId.slice(0, 8)}...)? [y/n] `,
    );
    const approved = String(answer).trim().toLowerCase().startsWith('y');

    try {
      await submitDecision(ap.approvalId, approved);
      const icon = approved ? 'OK' : 'NO';
      console.log(
        `[demo:approve] ${icon} ${approved ? 'APPROVED' : 'DENIED'}: ${ap.label} at ${new Date().toISOString()}\n`,
      );
    } catch (err) {
      console.error(`[demo:approve] Failed to submit decision: ${String(err)}\n`);
    }

    // Re-poll immediately after decision
    await sleep(500);
  }
}

process.on('SIGINT', () => {
  console.log('\n[demo:approve] Exiting.');
  rl.close();
  process.exit(0);
});

main().catch((err) => {
  console.error('[demo:approve] Fatal:', err);
  rl.close();
  process.exit(1);
});
