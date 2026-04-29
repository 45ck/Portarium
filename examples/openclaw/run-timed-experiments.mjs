#!/usr/bin/env node
/**
 * Detailed timed governance experiments for Portarium + OpenClaw integration.
 *
 * Runs 4 experiments sequentially, recording ISO timestamps at every step,
 * then writes per-experiment JSON results and a timing summary.
 *
 * Usage:
 *   PORTARIUM_URL=http://localhost:3000 node examples/openclaw/run-timed-experiments.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, 'results');

const BASE_URL = process.env.PORTARIUM_URL || 'http://localhost:3000';
const WORKSPACE = 'ws-experiment';
const AGENT_TOKEN = 'dev-token';
const OPERATOR_TOKEN = 'dev-token-operator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now() {
  return new Date().toISOString();
}

function epochMs() {
  return Date.now();
}

function ms(a, b) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function wsUrl(path) {
  return `${BASE_URL}/v1/workspaces/${WORKSPACE}${path}`;
}

async function api(method, path, body, token = AGENT_TOKEN) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Portarium-Tenant': 'default',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(wsUrl(path), opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

function writeResult(filename, data) {
  const path = resolve(RESULTS_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`  -> wrote ${path}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let allPassed = true;
const summaryExperiments = {};
const proposeRtts = [];

function failMissingApprovalId(result, propose, filename, summaryKey) {
  if (propose.json.approvalId) return false;

  const proposeRttMs = ms(result.timestamps.t1_propose_sent, result.timestamps.t2_propose_response);
  const failReason = `propose did not return approvalId (HTTP ${propose.status}, decision=${propose.json.decision})`;

  result.assertions.push({
    label: 'propose response includes approvalId before approval follow-up',
    passed: false,
    detail: failReason,
  });
  result.derived = { ...result.derived, propose_rtt_ms: proposeRttMs };
  result.failReason = failReason;
  result.outcome = 'FAILED';
  allPassed = false;
  proposeRtts.push(proposeRttMs);
  summaryExperiments[summaryKey] = {
    propose_rtt_ms: proposeRttMs,
    outcome: result.outcome,
    failReason,
  };

  console.error(`  failed: ${failReason}`);
  writeResult(filename, result);
  return true;
}

// ---------------------------------------------------------------------------
// Experiment A: Approval flow with timing
// ---------------------------------------------------------------------------

async function experimentA() {
  console.log('\n=== Experiment A: Approval flow with timing ===');
  const result = {
    experiment: 'A_approval_timed',
    timestamps: {},
    derived: {},
    polls: [],
    assertions: [],
  };

  // t0
  result.timestamps.t0_experiment_start = now();

  // t1 propose
  result.timestamps.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'timed-exp-agent',
    actionKind: 'tool_call',
    toolName: 'send_email',
    parameters: { to: 'user@example.com', subject: 'Quarterly report', body: 'Attached.' },
    rationale: 'Agent needs to send quarterly report email',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timestamps.t2_propose_response = now();
  result.propose = { httpStatus: propose.status, ...propose.json };
  const approvalId = propose.json.approvalId;
  const proposalId = propose.json.proposalId;
  const evidenceId = propose.json.evidenceId;
  console.log(
    `  propose: HTTP ${propose.status}, decision=${propose.json.decision}, approvalId=${approvalId}`,
  );

  result.assertions.push({
    label: 'propose returns 202 with NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  if (failMissingApprovalId(result, propose, 'exp-A-approval-timed.json', 'A_approval')) {
    return result;
  }

  // t3/t4 initial poll
  result.timestamps.t3_initial_poll = now();
  const initialPoll = await api('GET', `/approvals/${approvalId}`);
  result.timestamps.t4_initial_poll_response = now();
  result.initialPollStatus = initialPoll.json.status;
  console.log(`  initial poll: status=${initialPoll.json.status}`);

  result.assertions.push({
    label: 'initial poll returns Pending',
    passed: initialPoll.json.status === 'Pending',
    detail: `status=${initialPoll.json.status}`,
  });

  // t5/t6 decide (operator approves)
  result.timestamps.t5_decide_sent = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    { decision: 'Approved', rationale: 'Operator reviewed and approved email send' },
    OPERATOR_TOKEN,
  );
  result.timestamps.t6_decide_response = now();
  result.decide = { httpStatus: decide.status, ...decide.json };
  console.log(`  decide: HTTP ${decide.status}, status=${decide.json.status}`);

  result.assertions.push({
    label: 'decide returns 200 with Approved',
    passed: decide.status === 200 && decide.json.status === 'Approved',
    detail: `HTTP ${decide.status}, status=${decide.json.status}`,
  });

  // t7 polling loop to detect approval
  result.timestamps.t7_poller_loop_start = now();
  let detected = false;
  for (let i = 1; i <= 5; i++) {
    const pollTs = now();
    const poll = await api('GET', `/approvals/${approvalId}`);
    const pollResult = {
      poll_number: i,
      timestamp: pollTs,
      response_at: now(),
      status_observed: poll.json.status,
    };
    result.polls.push(pollResult);
    if (poll.json.status === 'Approved') {
      detected = true;
      result.timestamps.t8_approval_detected = now();
      break;
    }
    await sleep(200);
  }

  result.assertions.push({
    label: 'approval detected in poll loop',
    passed: detected,
    detail: `detected after ${result.polls.length} poll(s)`,
  });

  result.timestamps.t9_experiment_end = now();

  // Derived timings
  result.derived = {
    propose_rtt_ms: ms(result.timestamps.t1_propose_sent, result.timestamps.t2_propose_response),
    time_to_pending_ms: ms(
      result.timestamps.t1_propose_sent,
      result.timestamps.t4_initial_poll_response,
    ),
    time_pending_to_decided_ms: ms(
      result.timestamps.t4_initial_poll_response,
      result.timestamps.t6_decide_response,
    ),
    time_decided_to_detected_ms: ms(
      result.timestamps.t6_decide_response,
      result.timestamps.t8_approval_detected || result.timestamps.t9_experiment_end,
    ),
    total_governance_duration_ms: ms(
      result.timestamps.t0_experiment_start,
      result.timestamps.t8_approval_detected || result.timestamps.t9_experiment_end,
    ),
    polls_while_pending: result.polls.filter((p) => p.status_observed === 'Pending').length,
    polls_until_detected: result.polls.length,
    effective_poll_interval_ms:
      result.polls.length > 1
        ? Math.round(
            ms(result.polls[0].timestamp, result.polls[result.polls.length - 1].timestamp) /
              (result.polls.length - 1),
          )
        : 0,
  };
  proposeRtts.push(result.derived.propose_rtt_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'confirmed' : 'FAILED';

  summaryExperiments.A_approval = {
    total_ms: result.derived.total_governance_duration_ms,
    propose_rtt_ms: result.derived.propose_rtt_ms,
    polls_until_detected: result.derived.polls_until_detected,
    outcome: result.outcome,
  };

  console.log(
    `  outcome: ${result.outcome} (total ${result.derived.total_governance_duration_ms}ms)`,
  );
  writeResult('exp-A-approval-timed.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// Experiment B: Denial flow with timing
// ---------------------------------------------------------------------------

async function experimentB() {
  console.log('\n=== Experiment B: Denial flow with timing ===');
  const result = {
    experiment: 'B_denial_timed',
    timestamps: {},
    derived: {},
    polls: [],
    assertions: [],
  };

  result.timestamps.t0_experiment_start = now();

  // Propose
  result.timestamps.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'timed-exp-agent',
    actionKind: 'tool_call',
    toolName: 'drop_production_database',
    parameters: { database: 'prod_main', confirm: true },
    rationale: 'Agent wants to drop the production database for cleanup',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timestamps.t2_propose_response = now();
  result.propose = { httpStatus: propose.status, ...propose.json };
  const approvalId = propose.json.approvalId;
  console.log(
    `  propose: HTTP ${propose.status}, decision=${propose.json.decision}, approvalId=${approvalId}`,
  );

  result.assertions.push({
    label: 'propose returns 202 with NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  if (failMissingApprovalId(result, propose, 'exp-B-denial-timed.json', 'B_denial')) {
    return result;
  }

  // Initial poll
  result.timestamps.t3_initial_poll = now();
  const initialPoll = await api('GET', `/approvals/${approvalId}`);
  result.timestamps.t4_initial_poll_response = now();
  result.initialPollStatus = initialPoll.json.status;

  result.assertions.push({
    label: 'initial poll returns Pending',
    passed: initialPoll.json.status === 'Pending',
    detail: `status=${initialPoll.json.status}`,
  });

  // Deny
  result.timestamps.t5_decide_sent = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Denied',
      rationale: 'Unauthorized destructive operation — denied by security policy',
    },
    OPERATOR_TOKEN,
  );
  result.timestamps.t6_decide_response = now();
  result.decide = { httpStatus: decide.status, ...decide.json };
  console.log(`  deny: HTTP ${decide.status}, status=${decide.json.status}`);

  result.assertions.push({
    label: 'decide returns 200 with Denied',
    passed: decide.status === 200 && decide.json.status === 'Denied',
    detail: `HTTP ${decide.status}, status=${decide.json.status}`,
  });

  // Poll to confirm denial
  result.timestamps.t7_poller_loop_start = now();
  let detected = false;
  for (let i = 1; i <= 5; i++) {
    const pollTs = now();
    const poll = await api('GET', `/approvals/${approvalId}`);
    result.polls.push({
      poll_number: i,
      timestamp: pollTs,
      response_at: now(),
      status_observed: poll.json.status,
    });
    if (poll.json.status === 'Denied') {
      detected = true;
      result.timestamps.t8_denial_detected = now();
      break;
    }
    await sleep(200);
  }

  result.assertions.push({
    label: 'denial detected in poll loop',
    passed: detected,
    detail: `detected after ${result.polls.length} poll(s)`,
  });

  result.timestamps.t9_experiment_end = now();

  result.derived = {
    propose_rtt_ms: ms(result.timestamps.t1_propose_sent, result.timestamps.t2_propose_response),
    time_to_pending_ms: ms(
      result.timestamps.t1_propose_sent,
      result.timestamps.t4_initial_poll_response,
    ),
    time_pending_to_decided_ms: ms(
      result.timestamps.t4_initial_poll_response,
      result.timestamps.t6_decide_response,
    ),
    time_decided_to_detected_ms: ms(
      result.timestamps.t6_decide_response,
      result.timestamps.t8_denial_detected || result.timestamps.t9_experiment_end,
    ),
    total_governance_duration_ms: ms(
      result.timestamps.t0_experiment_start,
      result.timestamps.t8_denial_detected || result.timestamps.t9_experiment_end,
    ),
    polls_until_detected: result.polls.length,
  };
  proposeRtts.push(result.derived.propose_rtt_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'confirmed' : 'FAILED';

  summaryExperiments.B_denial = {
    total_ms: result.derived.total_governance_duration_ms,
    propose_rtt_ms: result.derived.propose_rtt_ms,
    polls_until_detected: result.derived.polls_until_detected,
    outcome: result.outcome,
  };

  console.log(
    `  outcome: ${result.outcome} (total ${result.derived.total_governance_duration_ms}ms)`,
  );
  writeResult('exp-B-denial-timed.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// Experiment C: Maker-checker enforcement timing
// ---------------------------------------------------------------------------

async function experimentC() {
  console.log('\n=== Experiment C: Maker-checker enforcement timing ===');
  const result = {
    experiment: 'C_maker_checker_timed',
    timestamps: {},
    derived: {},
    assertions: [],
  };

  result.timestamps.t0_experiment_start = now();

  // Propose (agent token)
  result.timestamps.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'timed-exp-agent',
    actionKind: 'tool_call',
    toolName: 'send_wire_transfer',
    parameters: { to: 'IBAN-DE89370400440532013000', amount: 50000, currency: 'EUR' },
    rationale: 'Agent initiating wire transfer for vendor payment',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timestamps.t2_propose_response = now();
  result.propose = { httpStatus: propose.status, ...propose.json };
  const approvalId = propose.json.approvalId;
  console.log(`  propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  if (failMissingApprovalId(result, propose, 'exp-C-maker-checker-timed.json', 'C_maker_checker')) {
    return result;
  }

  // Self-approve attempt (same agent token — should be 403)
  result.timestamps.t3_self_approve_sent = now();
  const selfApprove = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    { decision: 'Approved', rationale: 'Agent trying to approve its own request' },
    AGENT_TOKEN, // same user as proposer
  );
  result.timestamps.t4_self_approve_response = now();
  result.selfApprove = { httpStatus: selfApprove.status, ...selfApprove.json };
  console.log(`  self-approve: HTTP ${selfApprove.status} (expected 403)`);

  result.assertions.push({
    label: 'self-approve returns 403 Forbidden',
    passed: selfApprove.status === 403,
    detail: `HTTP ${selfApprove.status}, detail=${selfApprove.json.detail || selfApprove.json.message || 'N/A'}`,
  });

  // Legitimate operator approval — only proceed if self-approve was correctly rejected (403).
  // If self-approve returned 200, the experiment has already recorded a governance failure;
  // running operator-approve on top would produce a misleadingly mixed outcome.
  if (selfApprove.status !== 403) {
    const proposeRttMs = ms(
      result.timestamps.t1_propose_sent,
      result.timestamps.t2_propose_response,
    );
    result.outcome = 'FAILED';
    result.failReason = `Maker-checker NOT enforced: self-approve returned HTTP ${selfApprove.status} instead of 403`;
    result.timestamps.t7_experiment_end = now();
    result.derived = {
      propose_rtt_ms: proposeRttMs,
      enforcement_latency_ms: ms(
        result.timestamps.t3_self_approve_sent,
        result.timestamps.t4_self_approve_response,
      ),
      total_governance_duration_ms: ms(
        result.timestamps.t0_experiment_start,
        result.timestamps.t7_experiment_end,
      ),
    };
    allPassed = false;
    proposeRtts.push(proposeRttMs);
    summaryExperiments.C_maker_checker = {
      enforcement_latency_ms: result.derived.enforcement_latency_ms,
      propose_rtt_ms: proposeRttMs,
      outcome: result.outcome,
      failReason: result.failReason,
    };
    writeResult('exp-C-maker-checker-timed.json', result);
    return result;
  }

  result.timestamps.t5_operator_approve_sent = now();
  const operatorApprove = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Approved',
      rationale: 'Legitimate operator approval after maker-checker enforcement',
    },
    OPERATOR_TOKEN,
  );
  result.timestamps.t6_operator_approve_response = now();
  result.operatorApprove = { httpStatus: operatorApprove.status, ...operatorApprove.json };
  console.log(
    `  operator approve: HTTP ${operatorApprove.status}, status=${operatorApprove.json.status}`,
  );

  result.assertions.push({
    label: 'operator approve returns 200 Approved',
    passed: operatorApprove.status === 200 && operatorApprove.json.status === 'Approved',
    detail: `HTTP ${operatorApprove.status}, status=${operatorApprove.json.status}`,
  });

  result.timestamps.t7_experiment_end = now();

  result.derived = {
    propose_rtt_ms: ms(result.timestamps.t1_propose_sent, result.timestamps.t2_propose_response),
    enforcement_latency_ms: ms(
      result.timestamps.t3_self_approve_sent,
      result.timestamps.t4_self_approve_response,
    ),
    recovery_after_rejection_ms: ms(
      result.timestamps.t4_self_approve_response,
      result.timestamps.t6_operator_approve_response,
    ),
    total_governance_duration_ms: ms(
      result.timestamps.t0_experiment_start,
      result.timestamps.t7_experiment_end,
    ),
  };
  proposeRtts.push(result.derived.propose_rtt_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'confirmed' : 'FAILED';

  summaryExperiments.C_maker_checker = {
    enforcement_latency_ms: result.derived.enforcement_latency_ms,
    recovery_after_rejection_ms: result.derived.recovery_after_rejection_ms,
    propose_rtt_ms: result.derived.propose_rtt_ms,
    outcome: result.outcome,
  };

  console.log(
    `  outcome: ${result.outcome} (enforcement ${result.derived.enforcement_latency_ms}ms, recovery ${result.derived.recovery_after_rejection_ms}ms)`,
  );
  writeResult('exp-C-maker-checker-timed.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// Experiment D: Polling behavior under delay
// ---------------------------------------------------------------------------

async function experimentD() {
  console.log('\n=== Experiment D: Polling behavior under delay ===');
  const result = {
    experiment: 'D_polling_delay_timed',
    timestamps: {},
    derived: {},
    polls_during_wait: [],
    post_approval_poll: null,
    assertions: [],
  };

  result.timestamps.t0_experiment_start = now();

  // Propose
  result.timestamps.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'timed-exp-agent',
    actionKind: 'tool_call',
    toolName: 'deploy_to_staging',
    parameters: { service: 'api-gateway', version: 'v2.4.1', environment: 'staging' },
    rationale: 'Agent wants to deploy new version to staging',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timestamps.t2_propose_response = now();
  result.propose = { httpStatus: propose.status, ...propose.json };
  const approvalId = propose.json.approvalId;
  console.log(`  propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  if (failMissingApprovalId(result, propose, 'exp-D-polling-delay-timed.json', 'D_polling_delay')) {
    return result;
  }

  // Wait 8 seconds, polling every 2 seconds (4 polls while pending)
  console.log('  waiting 8s with 4 manual polls (every 2s)...');
  result.timestamps.t3_wait_start = now();

  for (let i = 1; i <= 4; i++) {
    await sleep(2000);
    const pollTs = now();
    const poll = await api('GET', `/approvals/${approvalId}`);
    const pollResult = {
      poll_number: i,
      timestamp: pollTs,
      response_at: now(),
      status_observed: poll.json.status,
      elapsed_since_propose_ms: ms(result.timestamps.t1_propose_sent, pollTs),
    };
    result.polls_during_wait.push(pollResult);
    console.log(
      `    poll ${i}: status=${poll.json.status} (elapsed ${pollResult.elapsed_since_propose_ms}ms)`,
    );
  }
  result.timestamps.t4_wait_end = now();

  const allPendingDuringWait = result.polls_during_wait.every(
    (p) => p.status_observed === 'Pending',
  );
  result.assertions.push({
    label: 'all 4 pre-approval polls return Pending',
    passed: allPendingDuringWait,
    detail: `statuses: [${result.polls_during_wait.map((p) => p.status_observed).join(', ')}]`,
  });

  // Now approve
  result.timestamps.t5_approve_sent = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    { decision: 'Approved', rationale: 'Operator approved staging deploy after review delay' },
    OPERATOR_TOKEN,
  );
  result.timestamps.t6_approve_response = now();
  result.decide = { httpStatus: decide.status, ...decide.json };
  console.log(`  approve after delay: HTTP ${decide.status}, status=${decide.json.status}`);

  // Immediate post-approval poll
  result.timestamps.t7_post_approval_poll = now();
  const postPoll = await api('GET', `/approvals/${approvalId}`);
  result.timestamps.t8_post_approval_poll_response = now();
  result.post_approval_poll = {
    timestamp: result.timestamps.t7_post_approval_poll,
    response_at: result.timestamps.t8_post_approval_poll_response,
    status_observed: postPoll.json.status,
  };
  console.log(`  post-approval poll: status=${postPoll.json.status}`);

  result.assertions.push({
    label: 'post-approval poll returns Approved',
    passed: postPoll.json.status === 'Approved',
    detail: `status=${postPoll.json.status}`,
  });

  result.timestamps.t9_experiment_end = now();

  const simulated_wait_ms = ms(result.timestamps.t3_wait_start, result.timestamps.t4_wait_end);
  const total_blocked_ms = ms(
    result.timestamps.t1_propose_sent,
    result.timestamps.t8_post_approval_poll_response,
  );

  result.derived = {
    propose_rtt_ms: ms(result.timestamps.t1_propose_sent, result.timestamps.t2_propose_response),
    simulated_wait_ms,
    total_blocked_duration_ms: total_blocked_ms,
    polls_during_wait: result.polls_during_wait.length,
    all_pending_during_wait: allPendingDuringWait,
    time_approve_to_detected_ms: ms(
      result.timestamps.t6_approve_response,
      result.timestamps.t8_post_approval_poll_response,
    ),
  };
  proposeRtts.push(result.derived.propose_rtt_ms);

  // Validate total blocked matches simulated wait (within tolerance)
  const waitMatchesTolerance = simulated_wait_ms >= 7500 && simulated_wait_ms <= 10000;
  result.assertions.push({
    label: 'simulated wait is approximately 8 seconds',
    passed: waitMatchesTolerance,
    detail: `simulated_wait_ms=${simulated_wait_ms} (expected ~8000)`,
  });

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'confirmed' : 'FAILED';

  summaryExperiments.D_polling_delay = {
    simulated_wait_ms,
    polls_during_wait: 4,
    all_pending_during_wait: allPendingDuringWait,
    total_blocked_duration_ms: total_blocked_ms,
    propose_rtt_ms: result.derived.propose_rtt_ms,
    outcome: result.outcome,
  };

  console.log(
    `  outcome: ${result.outcome} (wait ${simulated_wait_ms}ms, total blocked ${total_blocked_ms}ms)`,
  );
  writeResult('exp-D-polling-delay-timed.json', result);
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Portarium Timed Governance Experiments');
  console.log(`  control plane: ${BASE_URL}`);
  console.log(`  workspace: ${WORKSPACE}`);
  console.log(`  started at: ${now()}`);

  // Ensure results directory exists
  mkdirSync(RESULTS_DIR, { recursive: true });

  // Verify control plane is healthy
  try {
    const health = await fetch(`${BASE_URL}/health`);
    const hj = await health.json();
    console.log(`  health: ${hj.status}`);
    if (hj.status !== 'ok') {
      console.error('Control plane is not healthy. Aborting.');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Cannot reach control plane at ${BASE_URL}: ${e.message}`);
    process.exit(1);
  }

  await experimentA();
  await experimentB();
  await experimentC();
  await experimentD();

  // Write timing summary
  const summary = {
    run_at: now(),
    control_plane_mode: 'in-memory-dev',
    experiments: summaryExperiments,
    governance_overhead_analysis: {
      min_propose_rtt_ms: Math.min(...proposeRtts),
      max_propose_rtt_ms: Math.max(...proposeRtts),
      avg_propose_rtt_ms: Math.round(proposeRtts.reduce((a, b) => a + b, 0) / proposeRtts.length),
      notes:
        'RTT includes local HTTP round-trip only — in production this would include network latency to hosted control plane',
    },
  };

  writeResult('timing-summary.json', summary);

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));

  if (allPassed) {
    console.log('\nAll experiments PASSED.');
    process.exit(0);
  } else {
    console.error('\nSome experiments FAILED.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
