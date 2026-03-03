/**
 * H5: HTML approval UI — Demo script
 *
 * Simulates the full approval flow with a browser-friendly HTML UI:
 *   1. Start the approval proxy (with HTML UI at /approvals/ui)
 *   2. Invoke a CRITICAL tool -> receive pending approvalId
 *   3. Poll for approval status (plugin polls the JSON API)
 *   4. Auto-approve (if DEMO_AUTO_APPROVE=1) or print the UI URL for a human
 *   5. Show final result
 *
 * Run:  DEMO_AUTO_APPROVE=1 node demo.mjs
 */

import { startApprovalProxy } from './proxy-extension.mjs';
import { waitForApproval } from './plugin.mjs';

const PROXY_PORT = 9998;
const autoApprove = process.env['DEMO_AUTO_APPROVE'] === '1';

function log(msg) {
  console.log(`[h5-demo] ${msg}`);
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
  log('=== H5: HTML approval UI approval-wait loop ===');
  log('');

  // Step 1: Start proxy
  const proxy = await startApprovalProxy(PROXY_PORT);
  log(`Proxy running at ${proxy.url}`);
  log(`Approval UI at ${proxy.url}/approvals/ui`);
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
    log('Waiting for human decision...');

    // Step 4: If auto-approve, schedule a decision after 200ms
    if (autoApprove) {
      log('(DEMO_AUTO_APPROVE=1 — will auto-approve in 200ms)');
      setTimeout(async () => {
        log('Auto-approving...');
        const decideResult = await postJson(`${proxy.url}/approvals/${approvalId}/decide`, {
          decision: 'approved',
        });
        log(`Decision posted: ${JSON.stringify(decideResult)}`);
      }, 200);
    } else {
      log('');
      log('Open in your browser to approve or deny:');
      log(`  ${proxy.url}/approvals/ui`);
      log('');
      log('Or use curl:');
      log(
        `  curl -X POST http://localhost:${PROXY_PORT}/approvals/${approvalId}/decide -H "Content-Type: application/json" -d '{"decision":"approved"}'`,
      );
    }

    // Step 5: Poll for the decision
    const result = await waitForApproval(approvalId, proxy.url, {
      intervalMs: 500,
      timeoutMs: autoApprove ? 5000 : 30_000,
    });

    log('');
    log(`--- Decision received ---`);
    log(`Approved: ${result.approved}`);
    log(`Status:   ${result.status}`);
    log('');
    log('=== Demo complete ===');
  } finally {
    proxy.close();
  }
}

main().catch((err) => {
  console.error('[h5-demo] Fatal error:', err);
  process.exit(1);
});
