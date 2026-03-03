#!/usr/bin/env node
/**
 * Portarium Approval CLI — npm run demo:approve
 *
 * Companion CLI for human operators. Polls the Portarium policy proxy for
 * pending approvals and prompts for approve/deny decisions.
 *
 * Usage:
 *   npm run demo:approve
 *   node scripts/demo/portarium-approval-cli.mjs
 *   PROXY_URL=http://localhost:9998 node scripts/demo/portarium-approval-cli.mjs
 *
 * Runs indefinitely — keeps waiting for new approvals until Ctrl+C.
 * Suitable for leaving running overnight while agents submit requests.
 */

import { createInterface } from 'readline';
import { get, request } from 'http';

const PROXY_URL = process.env['PROXY_URL'] ?? 'http://localhost:9999';
const POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** @returns {Promise<{ approvals: Array<{ approvalId: string; toolName: string; createdAt: string; status: string }> }>} */
function listPendingApprovals() {
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
function postDecision(approvalId, decision) {
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
  console.log('\n[demo:approve] Portarium Approval CLI');
  console.log(
    `[demo:approve] Polling ${PROXY_URL}/approvals?status=pending every ${POLL_INTERVAL_MS / 1000}s`,
  );
  console.log('[demo:approve] Press Ctrl+C to exit.\n');

  // Wait for proxy to be available
  let connected = false;
  while (!connected) {
    try {
      await listPendingApprovals();
      connected = true;
    } catch {
      process.stdout.write('.');
      await sleep(1000);
    }
  }
  if (!connected) process.stdout.write('\n');
  console.log('[demo:approve] Connected to proxy.\n');

  let lastSeenCount = 0;

  while (true) {
    let data;
    try {
      data = await listPendingApprovals();
    } catch {
      process.stdout.write('⚠');
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const pending = data.approvals ?? [];

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
        console.log(`  ${i + 1}. Tool: ${ap.toolName}`);
        console.log(`     ID:      ${ap.approvalId}`);
        console.log(`     Created: ${ap.createdAt}`);
      }
      console.log('');
    }
    lastSeenCount = pending.length;

    // Process the oldest pending approval
    const ap = pending[0];
    const answer = await ask(
      `[demo:approve] Approve "${ap.toolName}" (${ap.approvalId.slice(0, 8)}…)? [y/n] `,
    );
    const decision = answer.trim().toLowerCase().startsWith('y') ? 'approved' : 'denied';

    try {
      const result = await postDecision(ap.approvalId, decision);
      const icon = decision === 'approved' ? '✅' : '❌';
      console.log(
        `[demo:approve] ${icon} ${decision.toUpperCase()}: ${result.toolName ?? ap.toolName} at ${result.decidedAt ?? new Date().toISOString()}\n`,
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
