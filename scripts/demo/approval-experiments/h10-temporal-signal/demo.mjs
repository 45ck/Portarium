/**
 * H10: Temporal Signal — Demo
 *
 * Shows the conceptual flow of a Temporal-signal-based approval-wait loop:
 *
 *   1. Agent calls a CRITICAL tool
 *   2. Proxy creates a "Temporal workflow" (simulated) that blocks on a signal
 *   3. Workflow pauses at `condition(() => approved)`
 *   4. Human (or DEMO_AUTO_APPROVE) sends the signal → workflow resumes
 *   5. Agent receives the decision and continues
 *
 * In production, the Temporal server provides:
 *   - Durable execution (survives proxy/server crashes)
 *   - Built-in audit log of all signals and workflow state
 *   - Temporal UI for operators to inspect pending approvals
 *   - Automatic retry and timeout policies
 *
 * Run:
 *   DEMO_AUTO_APPROVE=1 node scripts/demo/approval-experiments/h10-temporal-signal/demo.mjs
 */

import { createApproval, deliverDecision, listPending, server, PORT } from './proxy-extension.mjs';
import { waitForApproval } from './plugin.mjs';

const AUTO_APPROVE = process.env['DEMO_AUTO_APPROVE'] === '1';
const AUTO_APPROVE_DELAY_MS = parseInt(process.env['AUTO_APPROVE_DELAY_MS'] || '1500', 10);

// ---------------------------------------------------------------------------
// Simulated Temporal workflow lifecycle
// ---------------------------------------------------------------------------

console.log('='.repeat(70));
console.log('H10: Temporal Signal Approval-Wait Loop — Demo');
console.log('='.repeat(70));
console.log();
console.log('This demo simulates the Temporal signal integration pattern.');
console.log('In production, each approval creates a durable Temporal workflow');
console.log('that survives crashes and provides a built-in audit trail.');
console.log();

// Start the proxy server
await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`[proxy] Listening on http://localhost:${PORT}`);
console.log();

// Step 1: Agent calls a critical tool
console.log('[agent] Calling critical tool: deploy:production ...');
const { approvalId, workflowId, promise } = createApproval({ toolName: 'deploy:production' });
console.log(`[agent] Approval required — workflow ${workflowId} started`);
console.log(`[agent] Waiting for signal "${approvalId}" on Temporal workflow...`);
console.log();

// Step 2: Show pending approvals (like querying Temporal for running workflows)
const pending = listPending();
console.log(`[temporal-ui] Pending workflows: ${JSON.stringify(pending, null, 2)}`);
console.log();

// Step 3: Auto-approve or wait for manual signal
if (AUTO_APPROVE) {
  console.log(`[demo] DEMO_AUTO_APPROVE=1 — will auto-approve in ${AUTO_APPROVE_DELAY_MS}ms`);

  setTimeout(() => {
    console.log();
    console.log('[human] Sending approval signal via Temporal...');
    deliverDecision(approvalId, 'Approved');
  }, AUTO_APPROVE_DELAY_MS);
} else {
  console.log('[demo] Waiting for manual approval...');
  console.log(`[demo] POST http://localhost:${PORT}/approvals/${approvalId}/decide`);
  console.log('[demo]   Body: { "decision": "Approved" }');
  console.log();
  console.log('Or set DEMO_AUTO_APPROVE=1 to auto-approve.');
}

// Step 4: Agent waits (plugin polls in demo mode; real Temporal blocks deterministically)
const startWait = Date.now();
const decision = await promise;
const elapsed = Date.now() - startWait;

console.log();
console.log(`[agent] Decision received: ${decision} (after ${elapsed}ms)`);
console.log();

// Also demonstrate the plugin's waitForApproval path
console.log('[demo] Testing plugin.waitForApproval() path...');
const { approvalId: id2, promise: p2 } = createApproval({ toolName: 'delete:database' });

// Auto-approve immediately for the plugin test
setTimeout(() => deliverDecision(id2, 'Denied'), 500);

const pluginResult = await waitForApproval(id2, `http://localhost:${PORT}`);
console.log(`[plugin] Result: ${JSON.stringify(pluginResult)}`);

// Cleanup
console.log();
console.log('='.repeat(70));
console.log('Demo complete.');
console.log();
console.log('Key observations for Temporal signal pattern:');
console.log('  + Durable: workflows survive server crashes');
console.log('  + Audit: every signal and state transition is logged');
console.log('  + UI: Temporal Web UI shows pending approvals natively');
console.log('  - Infrastructure: requires a running Temporal server');
console.log('  - Complexity: workflow definitions, workers, task queues');
console.log('  - Overkill: for a standalone approval plugin');
console.log('='.repeat(70));

server.close();
process.exit(0);
