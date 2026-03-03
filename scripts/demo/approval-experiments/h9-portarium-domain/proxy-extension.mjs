#!/usr/bin/env node
// H9: Portarium domain wiring — proxy-extension (DEMO mock version)
//
// This DEMO version does NOT connect to a real Portarium server or database.
// Instead it creates an in-memory mock that mirrors the shape of the real
// Portarium approval domain model (ApprovalPendingV1 / ApprovalDecidedV1).
//
// For real integration, uncomment the "PRODUCTION WIRING" sections and
// point at a running Portarium control-plane instance.

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// In-memory mock of the Portarium ApprovalStore
// ---------------------------------------------------------------------------

/** @type {Map<string, import('../../../../src/domain/approvals/approval-v1.js').ApprovalV1>} */
const approvalStore = new Map();

/**
 * Creates an approval object matching the ApprovalPendingV1 shape from
 * src/domain/approvals/approval-v1.ts
 */
function createMockPendingApproval({ prompt, workspaceId, runId }) {
  const approvalId = `approval-${randomUUID().slice(0, 8)}`;
  /** @type {import('../../../../src/domain/approvals/approval-v1.js').ApprovalPendingV1} */
  const approval = {
    schemaVersion: 1,
    approvalId,
    workspaceId: workspaceId ?? 'workspace-demo',
    runId: runId ?? `run-${randomUUID().slice(0, 8)}`,
    planId: `plan-${randomUUID().slice(0, 8)}`,
    prompt,
    requestedAtIso: new Date().toISOString(),
    requestedByUserId: 'user-agent-system',
    status: 'Pending',
  };
  approvalStore.set(approvalId, approval);
  return approval;
}

/**
 * Decides an approval, transitioning from Pending to Approved/Denied/RequestChanges.
 * Mirrors the shape of ApprovalDecidedV1 from src/domain/approvals/approval-v1.ts
 *
 * PRODUCTION WIRING: In real Portarium, this would call:
 *   submitApproval(deps, ctx, { workspaceId, approvalId, decision, rationale })
 * from src/application/commands/submit-approval.ts
 */
function decideMockApproval(approvalId, { decision, rationale, decidedByUserId }) {
  const existing = approvalStore.get(approvalId);
  if (!existing) return null;
  if (existing.status !== 'Pending') return { error: 'already-decided' };

  /** @type {import('../../../../src/domain/approvals/approval-v1.js').ApprovalDecidedV1} */
  const decided = {
    ...existing,
    status: decision,
    decidedAtIso: new Date().toISOString(),
    decidedByUserId: decidedByUserId ?? 'user-human-reviewer',
    rationale: rationale ?? '',
  };
  approvalStore.set(approvalId, decided);

  // PRODUCTION WIRING: In real Portarium, the submitApproval command would also:
  // 1. Persist to ApprovalStore (PostgreSQL)
  // 2. Publish a CloudEvent (ApprovalGranted / ApprovalDenied / ApprovalChangesRequested)
  // 3. The event would be routed via the outbox dispatcher to downstream consumers

  return decided;
}

// ---------------------------------------------------------------------------
// HTTP server exposing mock Portarium approval API
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.H9_PORT ?? '9079', 10);

/**
 * PRODUCTION WIRING: In real Portarium, these endpoints already exist in the
 * control-plane handler at:
 *   - POST /v1/workspaces/:workspaceId/approvals         (create)
 *   - GET  /v1/workspaces/:workspaceId/approvals/:id     (get)
 *   - POST /v1/workspaces/:workspaceId/approvals/:id/decide (submit decision)
 *
 * This mock uses a simplified path shape for demo clarity.
 */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Content-Type', 'application/json');

  // POST /approvals — create a new pending approval
  if (req.method === 'POST' && url.pathname === '/approvals') {
    const body = await readBody(req);
    const approval = createMockPendingApproval({
      prompt: body.prompt ?? 'Approval required',
      workspaceId: body.workspaceId,
      runId: body.runId,
    });
    res.writeHead(201);
    res.end(JSON.stringify(approval));
    console.log(`[h9-proxy] Created approval ${approval.approvalId} — Pending`);
    return;
  }

  // GET /approvals/:id — fetch approval status
  const getMatch = url.pathname.match(/^\/approvals\/([^/]+)$/);
  if (req.method === 'GET' && getMatch) {
    const approval = approvalStore.get(getMatch[1]);
    if (!approval) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Approval not found' }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(approval));
    return;
  }

  // POST /approvals/:id/decide — submit a decision
  const decideMatch = url.pathname.match(/^\/approvals\/([^/]+)\/decide$/);
  if (req.method === 'POST' && decideMatch) {
    const body = await readBody(req);
    const result = decideMockApproval(decideMatch[1], {
      decision: body.decision ?? 'Approved',
      rationale: body.rationale ?? 'Auto-approved',
      decidedByUserId: body.decidedByUserId,
    });
    if (result === null) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Approval not found' }));
      return;
    }
    if (result.error) {
      res.writeHead(409);
      res.end(JSON.stringify({ error: result.error }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(result));
    console.log(`[h9-proxy] Decided ${decideMatch[1]} — ${body.decision}`);
    return;
  }

  // GET /approvals — list all (for debugging)
  if (req.method === 'GET' && url.pathname === '/approvals') {
    res.writeHead(200);
    res.end(JSON.stringify([...approvalStore.values()]));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`[h9-proxy] Portarium domain mock approval API on http://localhost:${PORT}`);
  console.log(`[h9-proxy] POST /approvals                — create pending approval`);
  console.log(`[h9-proxy] GET  /approvals/:id            — poll approval status`);
  console.log(`[h9-proxy] POST /approvals/:id/decide     — submit decision`);
  console.log();
  console.log(`[h9-proxy] Domain model shape: ApprovalPendingV1 / ApprovalDecidedV1`);
  console.log(`[h9-proxy] See src/domain/approvals/approval-v1.ts for the real types`);
  console.log();

  // PRODUCTION WIRING: The real Portarium control-plane would use:
  //   - ActionGatedToolInvoker for policy-gated tool execution
  //   - submitApproval command for decision persistence + CloudEvent emission
  //   - Cockpit UI at /approvals for native human review
});
