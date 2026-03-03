/**
 * H4: WebSocket channel — Demo script
 *
 * Simulates the full approval flow via WebSocket:
 *   1. Start the approval proxy
 *   2. Connect a WebSocket listener
 *   3. Invoke a CRITICAL tool -> receive pending approvalId
 *   4. WebSocket receives approval_required event
 *   5. Auto-approve (if DEMO_AUTO_APPROVE=1) after 150ms
 *   6. WebSocket receives approval_decision event
 *   7. waitForApproval resolves
 *
 * Run:  DEMO_AUTO_APPROVE=1 node demo.mjs
 */

import { startApprovalProxy } from './proxy-extension.mjs';
import { waitForApproval } from './plugin.mjs';

const PROXY_PORT = 9998;
const autoApprove = process.env['DEMO_AUTO_APPROVE'] === '1';

function log(msg) {
  console.log(`[h4-demo] ${msg}`);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main() {
  log('=== H4: WebSocket channel approval-wait loop ===');
  log('');

  // Step 1: Start proxy
  const proxy = await startApprovalProxy(PROXY_PORT);
  log(`Proxy running at ${proxy.url}`);
  log('');

  try {
    // Step 2: Invoke a non-critical tool (should execute immediately)
    log('--- Non-critical tool call ---');
    const safeResult = await postJson(`${proxy.url}/tools/invoke`, {
      toolName: 'read:file',
      parameters: { path: '/etc/hostname' },
    });
    log(`Result: ${JSON.stringify(safeResult)}`);
    log('');

    // Step 3: Invoke a CRITICAL tool (should return pending_approval)
    log('--- Critical tool call (requires approval) ---');
    const criticalResult = /** @type {any} */ (
      await postJson(`${proxy.url}/tools/invoke`, {
        toolName: 'shell.exec',
        parameters: { command: 'rm -rf /tmp/test' },
      })
    );
    log(`Result: ${JSON.stringify(criticalResult)}`);
    log('');

    if (criticalResult.status !== 'pending_approval') {
      log('ERROR: Expected pending_approval status for critical tool');
      return;
    }

    const { approvalId } = criticalResult;
    log(`Approval ID: ${approvalId}`);
    log('Waiting for human decision via WebSocket...');

    // Step 4: If auto-approve, schedule a decision after 150ms
    if (autoApprove) {
      log('(DEMO_AUTO_APPROVE=1 -- will auto-approve in 150ms)');
      setTimeout(async () => {
        log('Auto-approving via REST endpoint...');
        const decideResult = await postJson(`${proxy.url}/approvals/${approvalId}/decide`, {
          decision: 'approved',
        });
        log(`Decision posted: ${JSON.stringify(decideResult)}`);
      }, 150);
    } else {
      log('Waiting for external decision. Use:');
      log(
        `  curl -X POST http://localhost:${PROXY_PORT}/approvals/${approvalId}/decide -H "Content-Type: application/json" -d '{"decision":"approved"}'`,
      );
    }

    // Step 5: Wait for the decision via WebSocket (no polling!)
    const result = await waitForApproval(approvalId, proxy.url, {
      timeoutMs: autoApprove ? 5000 : 30_000,
    });

    log('');
    log('--- Decision received via WebSocket ---');
    log(`Approved: ${result.approved}`);
    log(`Status:   ${result.status}`);
    log('');
    log('=== Demo complete ===');
  } finally {
    proxy.close();
  }
}

main().catch((err) => {
  console.error('[h4-demo] Fatal error:', err);
  process.exit(1);
});
