#!/usr/bin/env node
// H9: Portarium domain wiring — demo
//
// Demonstrates the full approval-wait loop using Portarium's domain model.
// Runs an in-memory mock of the Portarium approval API (proxy-extension.mjs)
// and shows the domain object shapes (ApprovalPendingV1 / ApprovalDecidedV1).
//
// Usage:
//   DEMO_AUTO_APPROVE=1 node scripts/demo/approval-experiments/h9-portarium-domain/demo.mjs
//
// Without DEMO_AUTO_APPROVE, the approval stays Pending until manually decided
// via: curl -X POST http://localhost:9079/approvals/<id>/decide \
//        -H 'Content-Type: application/json' \
//        -d '{"decision":"Approved","rationale":"Looks good"}'

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { waitForApproval, createApproval, submitDecision } from './plugin.mjs';

const PORT = 9079;
const API_BASE = `http://localhost:${PORT}`;
const AUTO_APPROVE = process.env.DEMO_AUTO_APPROVE === '1';

// ---------------------------------------------------------------------------
// Inline mock server (same logic as proxy-extension.mjs, embedded for
// single-file demo convenience)
// ---------------------------------------------------------------------------

const store = new Map();

function makePending(prompt) {
  const id = `approval-${randomUUID().slice(0, 8)}`;
  const approval = {
    schemaVersion: 1,
    approvalId: id,
    workspaceId: 'workspace-demo',
    runId: `run-${randomUUID().slice(0, 8)}`,
    planId: `plan-${randomUUID().slice(0, 8)}`,
    prompt,
    requestedAtIso: new Date().toISOString(),
    requestedByUserId: 'user-agent-system',
    status: 'Pending',
  };
  store.set(id, approval);
  return approval;
}

function decide(id, decision, rationale) {
  const a = store.get(id);
  if (!a || a.status !== 'Pending') return a;
  const decided = {
    ...a,
    status: decision,
    decidedAtIso: new Date().toISOString(),
    decidedByUserId: 'user-human-reviewer',
    rationale,
  };
  store.set(id, decided);
  return decided;
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, API_BASE);
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && url.pathname === '/approvals') {
    const b = await readBody(req);
    const a = makePending(b.prompt ?? 'Approval required');
    res.writeHead(201).end(JSON.stringify(a));
    return;
  }
  const gm = url.pathname.match(/^\/approvals\/([^/]+)$/);
  if (req.method === 'GET' && gm) {
    const a = store.get(gm[1]);
    if (!a) { res.writeHead(404).end('{"error":"not found"}'); return; }
    res.writeHead(200).end(JSON.stringify(a));
    return;
  }
  const dm = url.pathname.match(/^\/approvals\/([^/]+)\/decide$/);
  if (req.method === 'POST' && dm) {
    const b = await readBody(req);
    const r = decide(dm[1], b.decision ?? 'Approved', b.rationale ?? '');
    if (!r) { res.writeHead(404).end('{"error":"not found"}'); return; }
    res.writeHead(200).end(JSON.stringify(r));
    return;
  }
  res.writeHead(404).end('{"error":"not found"}');
});

// ---------------------------------------------------------------------------
// Demo flow
// ---------------------------------------------------------------------------

async function runDemo() {
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[h9-demo] Mock Portarium approval API running on ${API_BASE}`);
  console.log();

  // Step 1: Agent creates an approval request
  console.log('=== Step 1: Agent creates approval request ===');
  const pending = await createApproval(API_BASE, {
    prompt: 'Agent wants to execute: deploy-to-production --env=staging --version=2.1.0',
    workspaceId: 'workspace-demo',
    runId: 'run-h9-demo',
  });

  console.log('Created ApprovalPendingV1:');
  console.log(JSON.stringify(pending, null, 2));
  console.log();

  // REAL PORTARIUM WIRING (commented out):
  //
  // In production, approval creation happens inside the workflow orchestrator:
  //
  //   // 1. ActionGatedToolInvoker evaluates blast-radius policy
  //   const gatedResult = await actionGatedInvoker.invoke({
  //     actor, tenantId, runId, actionId, correlationId,
  //     machineId, toolName: 'deploy-to-production',
  //     parameters: { env: 'staging', version: '2.1.0' },
  //     policyTier: 'production',
  //   });
  //
  //   // 2. If policy requires approval, the workflow creates an approval
  //   if (gatedResult.requiresApproval) {
  //     const approval = await createApprovalCommand(deps, ctx, {
  //       workspaceId, runId, planId, prompt: 'Deploy to staging v2.1.0',
  //       requestedByUserId: actor.userId,
  //     });
  //     // 3. CloudEvent "ApprovalRequested" is emitted via outbox
  //     // 4. Cockpit UI shows the approval in the human-tasks queue
  //     // 5. Workflow pauses (Temporal signal / long-poll / etc.)
  //   }

  // Step 2: Auto-approve or wait for human decision
  if (AUTO_APPROVE) {
    console.log('=== Step 2: Auto-approving (DEMO_AUTO_APPROVE=1) ===');
    setTimeout(async () => {
      const decided = await submitDecision(pending.approvalId, API_BASE, {
        decision: 'Approved',
        rationale: 'Auto-approved for demo purposes',
      });
      console.log('Decided ApprovalDecidedV1:');
      console.log(JSON.stringify(decided, null, 2));
    }, 2000);
  } else {
    console.log('=== Step 2: Waiting for human decision ===');
    console.log(`Approve via: curl -X POST ${API_BASE}/approvals/${pending.approvalId}/decide \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '{"decision":"Approved","rationale":"Looks good"}'`);
    console.log();
  }

  // Step 3: Plugin polls for decision
  console.log('=== Step 3: Polling for approval decision ===');
  try {
    const result = await waitForApproval(pending.approvalId, API_BASE, {
      pollIntervalMs: 500,
      timeoutMs: AUTO_APPROVE ? 10_000 : 300_000,
    });

    console.log();
    console.log('=== Result ===');
    console.log(`Status: ${result.status}`);
    console.log(`Decided by: ${result.decidedByUserId}`);
    console.log(`Rationale: ${result.rationale}`);
    console.log(`Decided at: ${result.decidedAtIso}`);
    console.log();
    console.log('Full ApprovalDecidedV1 object:');
    console.log(JSON.stringify(result, null, 2));

    // REAL PORTARIUM WIRING (commented out):
    //
    // After approval, the workflow would resume:
    //   // Temporal: signal the workflow with the decision
    //   await temporalClient.getHandle(runId).signal('approvalDecided', result);
    //
    //   // Or: the ActionGatedToolInvoker proceeds with execution
    //   if (result.status === 'Approved') {
    //     const execResult = await actionGatedInvoker.invoke({ ...originalInput, approved: true });
    //   }

    if (result.status === 'Approved') {
      console.log('\n[h9-demo] Agent would proceed with tool execution.');
    } else {
      console.log(`\n[h9-demo] Agent action ${result.status.toLowerCase()}.`);
    }
  } catch (err) {
    console.error(`[h9-demo] Error: ${err.message}`);
  }

  server.close();
}

runDemo().catch((err) => {
  console.error('[h9-demo] Fatal:', err);
  process.exit(1);
});
