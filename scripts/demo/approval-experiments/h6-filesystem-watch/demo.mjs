/**
 * H6: Filesystem Watch — Demo
 *
 * Demonstrates the filesystem-based approval handshake:
 *   1. Proxy writes `.pending.json` and starts `fs.watch()`
 *   2. With DEMO_AUTO_APPROVE=1, an `.approved` file is written after 100ms
 *   3. The watcher fires, resolving the approval promise
 *
 * Usage:
 *   DEMO_AUTO_APPROVE=1 node scripts/demo/approval-experiments/h6-filesystem-watch/demo.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { requestApproval, startApprovalServer } from './proxy-extension.mjs';
import { waitForApproval } from './plugin.mjs';

const WATCH_DIR = path.join(os.tmpdir(), '.portarium-approvals');

async function runDemo() {
  console.log('=== H6: Filesystem Watch Approval Demo ===\n');
  console.log(`Watch directory: ${WATCH_DIR}\n`);

  // --- Demo 1: Auto-approve via file creation ---
  console.log('--- Demo 1: Proxy requestApproval + auto-approve ---');

  const autoApprove = process.env['DEMO_AUTO_APPROVE'] === '1';

  const approvalPromise = requestApproval({
    toolName: 'shell.exec',
    parameters: { command: 'rm -rf /tmp/demo' },
    timeoutMs: 10_000,
  });

  if (autoApprove) {
    // Simulate an operator approving after 100ms by creating the file
    setTimeout(async () => {
      // Find the pending file to get the approval ID
      const files = fs.readdirSync(WATCH_DIR).filter((f) => f.endsWith('.pending.json'));
      if (files.length === 0) {
        console.log('[auto-approve] No pending files found');
        return;
      }
      const pendingFile = files[files.length - 1];
      const id = pendingFile.replace('.pending.json', '');
      const approvedPath = path.join(WATCH_DIR, `${id}.approved`);
      fs.writeFileSync(approvedPath, JSON.stringify({ autoApproved: true }));
      console.log(`[auto-approve] Created ${approvedPath}`);
    }, 100);
  } else {
    console.log(`Waiting for operator to create .approved/.denied file in ${WATCH_DIR}`);
    console.log('(Set DEMO_AUTO_APPROVE=1 to auto-approve)\n');
  }

  const result1 = await approvalPromise;
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log();

  // --- Demo 2: Plugin waitForApproval + HTTP convenience endpoint ---
  console.log('--- Demo 2: Plugin waitForApproval + HTTP decide endpoint ---');

  const server = await startApprovalServer(9877);
  const testId = 'demo-test-' + Date.now();

  // Start waiting via the plugin
  const waitPromise = waitForApproval(testId, WATCH_DIR, { timeoutMs: 10_000 });

  // Simulate decision via HTTP after 150ms
  setTimeout(async () => {
    try {
      const res = await fetch(`${server.url}/approvals/${testId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approved' }),
      });
      const data = await res.json();
      console.log('[http-decide]', JSON.stringify(data));
    } catch (err) {
      console.error('[http-decide] Error:', err.message);
    }
  }, 150);

  const result2 = await waitPromise;
  console.log('Result:', JSON.stringify(result2, null, 2));

  // Cleanup
  server.close();

  // Remove any leftover files
  try {
    const leftovers = fs.readdirSync(WATCH_DIR);
    for (const f of leftovers) {
      fs.unlinkSync(path.join(WATCH_DIR, f));
    }
  } catch { /* ignore */ }

  console.log('\n=== Demo complete ===');
}

runDemo().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
