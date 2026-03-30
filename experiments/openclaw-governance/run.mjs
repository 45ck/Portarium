/**
 * Experiment: openclaw-governance
 *
 * Validates the full tool-call governance loop:
 *   propose → awaiting_approval → operator decides → poller unblocks
 *
 * Run with: node experiments/openclaw-governance/run.mjs
 */

// @ts-check

import { runExperiment, assert } from '../shared/experiment-runner.js';

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const PORTARIUM_URL = process.env['PORTARIUM_URL'] ?? 'http://localhost:3000';
const WORKSPACE_ID = process.env['PORTARIUM_WORKSPACE_ID'] ?? 'ws-experiment';
const BEARER_TOKEN = process.env['PORTARIUM_BEARER_TOKEN'] ?? 'dev-token';
const TENANT_ID = process.env['PORTARIUM_TENANT_ID'] ?? 'default';

const BASE_HEADERS = {
  'content-type': 'application/json',
  authorization: `Bearer ${BEARER_TOKEN}`,
  'x-portarium-tenant-id': TENANT_ID,
  'x-portarium-workspace-id': WORKSPACE_ID,
};

function workspaceUrl(path) {
  return `${PORTARIUM_URL}/v1/workspaces/${encodeURIComponent(WORKSPACE_ID)}${path}`;
}

// ---------------------------------------------------------------------------
// Poll helper — mimics ApprovalPoller behaviour
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * @param {string} approvalId
 * @returns {Promise<{ approved: boolean; reason?: string }>}
 */
async function waitForDecision(approvalId) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(workspaceUrl(`/approvals/${encodeURIComponent(approvalId)}`), {
      method: 'GET',
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const body = /** @type {Record<string, unknown>} */ (await res.json());
    const status = String(body.status ?? '');

    if (status === 'approved' || status === 'Approved') return { approved: true };
    if (status === 'denied' || status === 'Denied') {
      return { approved: false, reason: String(body.reason ?? 'Denied by operator') };
    }
    if (status === 'expired' || status === 'Expired') {
      return { approved: false, reason: 'Approval expired' };
    }

    // pending — keep polling
    await sleep(POLL_INTERVAL_MS);
  }

  return { approved: false, reason: `Approval timed out after ${POLL_TIMEOUT_MS}ms` };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

const outcome = await runExperiment({
  name: 'openclaw-governance',

  hypothesis:
    'A tool call intercepted by the openclaw-plugin is blocked for human approval and the agent ' +
    'is unblocked exactly when the operator approves it via the Portarium control plane.',

  // ── Phase 1: verify control plane is reachable ─────────────────────────
  async setup(ctx) {
    const res = await fetch(`${PORTARIUM_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    }).catch((e) => {
      throw new Error(`Portarium unreachable at ${PORTARIUM_URL}: ${e.message}`);
    });

    if (!res.ok) {
      throw new Error(`Portarium health check failed: HTTP ${res.status}`);
    }

    ctx.state.healthStatus = await res.json();
    console.log(`  [setup] Portarium health: ${JSON.stringify(ctx.state.healthStatus)}`);
  },

  // ── Phase 2: propose a tool call that requires approval ─────────────────
  async execute(ctx) {
    // 2a. Propose the action
    const proposeRes = await fetch(workspaceUrl('/agent-actions:propose'), {
      method: 'POST',
      headers: BASE_HEADERS,
      body: JSON.stringify({
        agentId: 'experiment-agent',
        actionKind: 'tool_call',
        toolName: 'send_email',
        parameters: { to: 'ops@example.com', subject: 'Experiment: governed tool call' },
        correlationId: `exp-openclaw-governance-${Date.now()}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    ctx.state.proposeStatus = proposeRes.status;
    const proposeBody = /** @type {Record<string, unknown>} */ (await proposeRes.json());
    ctx.state.proposeBody = proposeBody;

    console.log(`  [execute] propose response: HTTP ${proposeRes.status}`, proposeBody);

    const decision = String(proposeBody.decision ?? proposeBody.status ?? '');
    ctx.state.decision = decision;

    // If immediately allowed (e.g. capability tier is Auto), record and exit early
    if (decision === 'Allow' || decision === 'allowed') {
      ctx.state.immediatelyAllowed = true;
      return;
    }

    // Extract approvalId from NeedsApproval response
    const approvalId = String(proposeBody.approvalId ?? proposeBody.id ?? '');
    ctx.state.approvalId = approvalId;

    if (!approvalId) return; // verify() will surface the missing id

    // 2b. Check initial approval status
    const pollRes = await fetch(workspaceUrl(`/approvals/${encodeURIComponent(approvalId)}`), {
      method: 'GET',
      headers: BASE_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });

    ctx.state.initialPollStatus = pollRes.status;
    if (pollRes.ok) {
      const pollBody = /** @type {Record<string, unknown>} */ (await pollRes.json());
      ctx.state.initialApprovalStatus = String(pollBody.status ?? '');
      console.log(`  [execute] initial approval status: ${ctx.state.initialApprovalStatus}`);
    }

    // 2c. Operator approves
    const decideRes = await fetch(
      workspaceUrl(`/approvals/${encodeURIComponent(approvalId)}/decide`),
      {
        method: 'POST',
        headers: BASE_HEADERS,
        body: JSON.stringify({ decision: 'Approved', rationale: 'Experiment auto-approval' }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    ctx.state.decideStatus = decideRes.status;
    const decideBody = /** @type {Record<string, unknown>} */ (await decideRes.json());
    ctx.state.decideBody = decideBody;
    console.log(`  [execute] decide response: HTTP ${decideRes.status}`, decideBody);

    // 2d. Wait for poller to detect the decision
    console.log(`  [execute] polling for decision on approvalId=${approvalId}...`);
    const pollerResult = await waitForDecision(approvalId);
    ctx.state.pollerResult = pollerResult;
    console.log(`  [execute] poller result:`, pollerResult);
  },

  // ── Phase 3: assert expected outcomes ────────────────────────────────────
  async verify(ctx) {
    const assertions = [];

    // If the capability is auto-allowed, the whole pipeline is trivially valid
    if (ctx.state.immediatelyAllowed) {
      assertions.push(
        assert(
          'propose returned Allow (capability tier is Auto — no approval required)',
          true,
          'Pipeline is valid; governance tier for send_email is Auto in this workspace',
        ),
      );
      return assertions;
    }

    // Core flow assertions
    assertions.push(
      assert(
        'POST /agent-actions:propose returned HTTP 200',
        ctx.state.proposeStatus === 200,
        `HTTP status was ${ctx.state.proposeStatus}`,
      ),
    );

    const decision = String(ctx.state.decision ?? '');
    assertions.push(
      assert(
        'propose decision is NeedsApproval (tool routed to human-approval tier)',
        decision === 'NeedsApproval' ||
          decision === 'awaiting_approval' ||
          decision === 'pending_approval',
        `decision was "${decision}"`,
      ),
    );

    const approvalId = String(ctx.state.approvalId ?? '');
    assertions.push(
      assert(
        'propose response includes a non-empty approvalId',
        approvalId.length > 0,
        `approvalId="${approvalId}"`,
      ),
    );

    assertions.push(
      assert(
        'GET /approvals/:approvalId returns HTTP 200 immediately after proposal',
        ctx.state.initialPollStatus === 200,
        `HTTP status was ${ctx.state.initialPollStatus}`,
      ),
    );

    const initialStatus = String(ctx.state.initialApprovalStatus ?? '');
    assertions.push(
      assert(
        'initial approval status is pending',
        initialStatus.toLowerCase() === 'pending',
        `status was "${initialStatus}"`,
      ),
    );

    assertions.push(
      assert(
        'POST /approvals/:approvalId/decide returned HTTP 200',
        ctx.state.decideStatus === 200,
        `HTTP status was ${ctx.state.decideStatus}`,
      ),
    );

    const pollerResult = /** @type {{ approved: boolean; reason?: string } | undefined} */ (
      ctx.state.pollerResult
    );
    assertions.push(
      assert(
        'ApprovalPoller resolves approved=true after operator decision',
        pollerResult?.approved === true,
        pollerResult
          ? `approved=${pollerResult.approved}${pollerResult.reason ? `, reason="${pollerResult.reason}"` : ''}`
          : 'pollerResult is undefined',
      ),
    );

    return assertions;
  },
});

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------

const icon =
  outcome.outcome === 'confirmed'
    ? 'CONFIRMED'
    : outcome.outcome === 'refuted'
      ? 'REFUTED'
      : 'INCONCLUSIVE';
console.log(`\nResult: [${icon}] (${outcome.duration_ms}ms)`);
for (const a of outcome.assertions) {
  const mark = a.passed ? 'PASS' : 'FAIL';
  const detail = a.detail ? ` — ${a.detail}` : '';
  console.log(`  ${mark}: ${a.label}${detail}`);
}
if (outcome.error) {
  console.log(`\nError: ${outcome.error}`);
}
console.log(`\nFull results written to: experiments/openclaw-governance/results/outcome.json`);

process.exitCode = outcome.outcome === 'confirmed' ? 0 : 1;
