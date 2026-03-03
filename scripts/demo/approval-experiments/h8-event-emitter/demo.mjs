#!/usr/bin/env node
/**
 * H8 demo — in-process EventEmitter approval loop
 *
 * Shows that when the proxy is imported (not running as a separate process),
 * approvals can be resolved entirely in-memory via EventEmitter with zero
 * HTTP overhead.
 *
 * Run:  node scripts/demo/approval-experiments/h8-event-emitter/demo.mjs
 */

import { requestApproval } from './proxy-extension.mjs';
import { createApprovalHandler } from './plugin.mjs';

// ---------------------------------------------------------------------------
// 1. Register an in-process handler that auto-approves after 50 ms
// ---------------------------------------------------------------------------

const unsubscribe = createApprovalHandler(async ({ approvalId, toolName }) => {
  console.log(`  [handler] approval:required for "${toolName}" (id=${approvalId})`);
  await new Promise((r) => setTimeout(r, 50)); // simulate deliberation
  console.log(`  [handler] auto-approving after 50 ms`);
  return { decision: 'approved', reason: 'Auto-approved by in-process handler' };
});

// ---------------------------------------------------------------------------
// 2. Simulate a CRITICAL tool call
// ---------------------------------------------------------------------------

console.log('\n=== H8: In-process EventEmitter approval loop ===\n');
console.log('Key insight: no HTTP round-trip — everything happens in one process.\n');
console.log('Requesting approval for "deploy:production" ...');

const t0 = performance.now();

const result = await requestApproval({
  toolName: 'deploy:production',
  parameters: { environment: 'production', version: '2.3.1' },
});

const elapsed = (performance.now() - t0).toFixed(1);

console.log(`\nResult: ${result.decision} (${result.reason})`);
console.log(`Latency: ${elapsed} ms (vs ~100-300 ms for HTTP-based loops)\n`);

// ---------------------------------------------------------------------------
// 3. Show limitation: this only works because we imported the module
// ---------------------------------------------------------------------------

console.log('--- Limitation ---');
console.log('This pattern ONLY works when proxy and handler share the same process.');
console.log('A separate proxy process would have its own EventEmitter instance,');
console.log('so events would never reach this handler.\n');

unsubscribe();
console.log('Handler unsubscribed. Done.\n');
