#!/usr/bin/env node
/**
 * Nexus Capital Advisory -- Business Governance Scenarios
 *
 * 6 realistic financial-services scenarios demonstrating AI governance:
 *   1. Auto-approved CRM read (zero human overhead)
 *   2. Client email approval (compliance manager)
 *   3. $2M trade execution (portfolio manager, 5s deliberation)
 *   4. 2:47am production deploy (on-call engineer)
 *   5. Bulk email campaign denied (compliance officer)
 *   6. GDPR deletion with maker-checker enforcement (DPO)
 *
 * Usage:
 *   PORTARIUM_URL=http://localhost:3000 node examples/openclaw/business-scenarios/run-business-experiments.mjs
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
  console.log(`    -> ${filename}`);
}

function sleep(duration) {
  return new Promise((r) => setTimeout(r, duration));
}

let allPassed = true;
const proposeRtts = [];
const scenarioSummaries = [];

// ---------------------------------------------------------------------------
// Scenario 1: Auto-Approved Read (no human needed)
// ---------------------------------------------------------------------------

async function scenario1() {
  console.log('\n--- Scenario 1: Auto-Approved CRM Read ---');
  console.log('    Agent: Aria (aria-customer-service)');
  console.log('    Tool: crm_read_client | Tier: Auto');

  const result = {
    scenario: '1-crm-read-auto',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Aria', id: 'aria-customer-service', role: 'Customer Service AI' },
    human_operator: null,
    tool: 'crm_read_client',
    governance_tier: 'Auto',
    outcome: null,
    timeline: {},
    governance_data: {},
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'aria-customer-service',
    actionKind: 'tool_call',
    toolName: 'crm_read_client',
    parameters: { clientId: 'CLT-4821', requestReason: 'Client inquiry about account balance' },
    rationale: 'Client called about their account balance. Reading client profile to assist.',
    policyIds: ['default-governance'],
    executionTier: 'Auto',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  result.governance_data = {
    proposalId: propose.json.proposalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
    httpStatus: propose.status,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'Auto tier returns HTTP 200 with Allow',
    passed: propose.status === 200 && propose.json.decision === 'Allow',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  result.assertions.push({
    label: 'No approvalId required (agent proceeds immediately)',
    passed: !propose.json.approvalId,
    detail: `approvalId=${propose.json.approvalId || 'none'}`,
  });

  result.timeline.t3_approval_status = 'Allow';
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = 0;
  result.timeline.polls = [];

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'auto_allowed' : 'FAILED';
  result.business_insight =
    'Read-only CRM lookups bypass human approval entirely, enabling Aria to serve clients instantly with zero governance overhead.';

  scenarioSummaries.push({ scenario: 1, outcome: result.outcome, propose_rtt_ms: result.timeline.t2_propose_response_ms });

  console.log(`    outcome: ${result.outcome} (${result.timeline.t2_propose_response_ms}ms RTT)`);
  writeResult('scenario-1-crm-read-auto.json', result);
}

// ---------------------------------------------------------------------------
// Scenario 2: Client Email -- Compliance Manager Approves
// ---------------------------------------------------------------------------

async function scenario2() {
  console.log('\n--- Scenario 2: Client Email Approval ---');
  console.log('    Agent: Aria (aria-customer-service)');
  console.log('    Approver: Sarah Chen, Compliance Manager');
  console.log('    Tool: email_send_client | Tier: HumanApprove');

  const result = {
    scenario: '2-email-approval',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Aria', id: 'aria-customer-service', role: 'Customer Service AI' },
    human_operator: { name: 'Sarah Chen', role: 'Compliance Manager' },
    tool: 'email_send_client',
    governance_tier: 'HumanApprove',
    outcome: null,
    timeline: {},
    governance_data: {},
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'aria-customer-service',
    actionKind: 'tool_call',
    toolName: 'email_send_client',
    parameters: {
      to: 'eleanor.watts@clientco.com',
      subject: 'Resolution of your complaint ref #2847',
      body: 'Dear Ms Watts, we are pleased to confirm your complaint has been resolved. Our review found the billing discrepancy was caused by a system update on 12 March. A credit of $847.50 has been applied to your account. Please do not hesitate to contact us if you have further questions.',
    },
    rationale: 'Following complaint resolution #2847 -- sending confirmation to client as per SLA',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  const approvalId = propose.json.approvalId;
  result.governance_data = {
    proposalId: propose.json.proposalId,
    approvalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  // Initial poll
  const pollTs = now();
  const initialPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.t3_approval_status = initialPoll.json.status;
  result.timeline.polls = [{ n: 1, at: pollTs, status: initialPoll.json.status }];

  result.assertions.push({
    label: 'initial status is Pending',
    passed: initialPoll.json.status === 'Pending',
    detail: `status=${initialPoll.json.status}`,
  });

  // Sarah Chen approves
  result.timeline.t4_operator_decided = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Approved',
      rationale: 'Email content reviewed. Complaint resolution confirmed in system. Approved to send to client.',
    },
    OPERATOR_TOKEN,
  );

  result.governance_data.operator_rationale =
    'Email content reviewed. Complaint resolution confirmed in system. Approved to send to client.';

  result.assertions.push({
    label: 'operator approval succeeds',
    passed: decide.status === 200 && decide.json.status === 'Approved',
    detail: `HTTP ${decide.status}, status=${decide.json.status}`,
  });

  // Confirm via poll
  const confirmPollTs = now();
  const confirmPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.polls.push({ n: 2, at: confirmPollTs, status: confirmPoll.json.status });
  result.timeline.t5_detection_latency_ms = ms(result.timeline.t4_operator_decided, confirmPollTs);
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = ms(result.timeline.t1_propose_sent, result.timeline.t6_agent_unblocked);

  result.assertions.push({
    label: 'post-approval poll returns Approved',
    passed: confirmPoll.json.status === 'Approved',
    detail: `status=${confirmPoll.json.status}`,
  });

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'approved' : 'FAILED';
  result.business_insight =
    'Customer-facing emails are held for compliance review before sending, ensuring Aria never sends unapproved communications to clients.';

  scenarioSummaries.push({ scenario: 2, outcome: result.outcome, propose_rtt_ms: result.timeline.t2_propose_response_ms, total_blocked_ms: result.timeline.total_blocked_ms });

  console.log(`    outcome: ${result.outcome} (blocked ${result.timeline.total_blocked_ms}ms)`);
  writeResult('scenario-2-email-approval.json', result);
}

// ---------------------------------------------------------------------------
// Scenario 3: $2M Trade Execution -- Portfolio Manager Approves After 5s
// ---------------------------------------------------------------------------

async function scenario3() {
  console.log('\n--- Scenario 3: $2M Trade Execution ---');
  console.log('    Agent: Atlas (atlas-finance)');
  console.log('    Approver: Marcus Webb, Portfolio Manager');
  console.log('    Tool: trading_execute_order | Tier: HumanApprove');
  console.log('    Simulating 5s deliberation...');

  const result = {
    scenario: '3-trade-execution',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Atlas', id: 'atlas-finance', role: 'Trading AI' },
    human_operator: { name: 'Marcus Webb', role: 'Portfolio Manager' },
    tool: 'trading_execute_order',
    governance_tier: 'HumanApprove',
    outcome: null,
    timeline: {},
    governance_data: {},
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'atlas-finance',
    actionKind: 'tool_call',
    toolName: 'trading_execute_order',
    parameters: {
      symbol: 'NVDA',
      side: 'BUY',
      quantity: 8500,
      estimatedValue: 2040000,
      strategy: 'momentum-breakout',
      urgency: 'high',
    },
    rationale:
      'NVDA breaking above 200-day MA with volume confirmation. Momentum strategy signal triggered. Est. value $2.04M.',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  const approvalId = propose.json.approvalId;
  result.governance_data = {
    proposalId: propose.json.proposalId,
    approvalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  // Poll during deliberation (every ~1.5s for 5s)
  result.timeline.t3_approval_status = 'Pending';
  result.timeline.polls = [];
  const deliberationStart = now();

  for (let i = 1; i <= 3; i++) {
    await sleep(1500);
    const pollTs = now();
    const poll = await api('GET', `/approvals/${approvalId}`);
    result.timeline.polls.push({ n: i, at: pollTs, status: poll.json.status });
    console.log(`    poll ${i}: ${poll.json.status} (deliberating...)`);
  }

  // After ~4.5s, one more short wait to hit 5s total
  await sleep(500);

  // Marcus Webb approves after deliberation
  result.timeline.t4_operator_decided = now();
  const deliberation_ms = ms(deliberationStart, result.timeline.t4_operator_decided);
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Approved',
      rationale:
        'Checked risk exposure: position within limits. NVDA technical setup confirmed on Bloomberg. Volume above 2x average. Approved for execution.',
    },
    OPERATOR_TOKEN,
  );

  result.governance_data.operator_rationale =
    'Checked risk exposure: position within limits. NVDA technical setup confirmed on Bloomberg. Volume above 2x average. Approved for execution.';

  result.assertions.push({
    label: 'operator approval succeeds after deliberation',
    passed: decide.status === 200 && decide.json.status === 'Approved',
    detail: `HTTP ${decide.status}, status=${decide.json.status}, deliberation=${deliberation_ms}ms`,
  });

  // Confirm via poll
  const confirmPollTs = now();
  const confirmPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.polls.push({ n: 4, at: confirmPollTs, status: confirmPoll.json.status });
  result.timeline.t5_detection_latency_ms = ms(result.timeline.t4_operator_decided, confirmPollTs);
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = ms(result.timeline.t1_propose_sent, result.timeline.t6_agent_unblocked);
  result.timeline.deliberation_ms = deliberation_ms;

  result.assertions.push({
    label: 'all polls during deliberation return Pending',
    passed: result.timeline.polls.slice(0, 3).every((p) => p.status === 'Pending'),
    detail: `statuses: [${result.timeline.polls.slice(0, 3).map((p) => p.status).join(', ')}]`,
  });

  result.assertions.push({
    label: 'post-approval poll returns Approved',
    passed: confirmPoll.json.status === 'Approved',
    detail: `status=${confirmPoll.json.status}`,
  });

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'approved' : 'FAILED';
  result.business_insight =
    'A $2.04M NVDA trade was held for 5 seconds while the portfolio manager verified risk limits and technical setup on Bloomberg before approving execution.';

  scenarioSummaries.push({ scenario: 3, outcome: result.outcome, propose_rtt_ms: result.timeline.t2_propose_response_ms, total_blocked_ms: result.timeline.total_blocked_ms, deliberation_ms });

  console.log(`    outcome: ${result.outcome} (blocked ${result.timeline.total_blocked_ms}ms, deliberation ${deliberation_ms}ms)`);
  writeResult('scenario-3-trade-execution.json', result);
}

// ---------------------------------------------------------------------------
// Scenario 4: 2:47am Production Deploy -- On-Call Engineer Approves
// ---------------------------------------------------------------------------

async function scenario4() {
  console.log('\n--- Scenario 4: 2:47am Emergency Production Deploy ---');
  console.log('    Agent: Zeus (zeus-operations)');
  console.log('    Approver: David Park, On-Call Engineer');
  console.log('    Tool: infra_deploy_production | Tier: HumanApprove');

  const result = {
    scenario: '4-prod-deploy-2am',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Zeus', id: 'zeus-operations', role: 'Operations AI' },
    human_operator: { name: 'David Park', role: 'On-Call Engineer (woken at 2:47am)' },
    tool: 'infra_deploy_production',
    governance_tier: 'HumanApprove',
    outcome: null,
    timeline: {},
    governance_data: {},
    metadata: {
      simulated_time: '2026-03-31T02:47:00.000Z',
      incident_context: 'Critical payment processing bug. 847 failed transactions in the last hour.',
    },
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'zeus-operations',
    actionKind: 'tool_call',
    toolName: 'infra_deploy_production',
    parameters: {
      service: 'payment-processor',
      version: 'v2.14.3-hotfix',
      environment: 'production',
      rollbackVersion: 'v2.14.2',
      reason: 'Critical null-pointer exception causing payment failures -- 847 failed transactions in last hour',
    },
    rationale:
      'Critical payment processing bug in production. 847 failed transactions. Hotfix v2.14.3-hotfix tested in staging for 45 minutes with 0 errors. Requesting emergency production deploy.',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  const approvalId = propose.json.approvalId;
  result.governance_data = {
    proposalId: propose.json.proposalId,
    approvalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  // Initial poll
  const pollTs = now();
  const initialPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.t3_approval_status = initialPoll.json.status;
  result.timeline.polls = [{ n: 1, at: pollTs, status: initialPoll.json.status }];

  // David Park approves (oncall woken at 2:47am)
  result.timeline.t4_operator_decided = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Approved',
      rationale:
        'Verified staging results: 0 errors over 45 min. Rollback version v2.14.2 confirmed available. 847 failed txns warrants emergency deploy. Approved.',
    },
    OPERATOR_TOKEN,
  );

  result.governance_data.operator_rationale =
    'Verified staging results: 0 errors over 45 min. Rollback version v2.14.2 confirmed available. 847 failed txns warrants emergency deploy. Approved.';

  result.assertions.push({
    label: 'on-call engineer approves emergency deploy',
    passed: decide.status === 200 && decide.json.status === 'Approved',
    detail: `HTTP ${decide.status}, status=${decide.json.status}`,
  });

  // Confirm
  const confirmPollTs = now();
  const confirmPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.polls.push({ n: 2, at: confirmPollTs, status: confirmPoll.json.status });
  result.timeline.t5_detection_latency_ms = ms(result.timeline.t4_operator_decided, confirmPollTs);
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = ms(result.timeline.t1_propose_sent, result.timeline.t6_agent_unblocked);

  result.assertions.push({
    label: 'post-approval poll returns Approved',
    passed: confirmPoll.json.status === 'Approved',
    detail: `status=${confirmPoll.json.status}`,
  });

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'approved' : 'FAILED';
  result.business_insight =
    'Even at 2:47am during a critical outage, Zeus cannot deploy to production without a human engineer confirming the hotfix and rollback plan.';

  scenarioSummaries.push({ scenario: 4, outcome: result.outcome, propose_rtt_ms: result.timeline.t2_propose_response_ms, total_blocked_ms: result.timeline.total_blocked_ms });

  console.log(`    outcome: ${result.outcome} (blocked ${result.timeline.total_blocked_ms}ms)`);
  writeResult('scenario-4-prod-deploy-2am.json', result);
}

// ---------------------------------------------------------------------------
// Scenario 5: Bulk Email Campaign -- DENIED by Compliance
// ---------------------------------------------------------------------------

async function scenario5() {
  console.log('\n--- Scenario 5: Bulk Email Campaign -- DENIED ---');
  console.log('    Agent: Aria (aria-customer-service) [prompt injection suspected]');
  console.log('    Reviewer: Rachel Torres, Chief Compliance Officer');
  console.log('    Tool: email_send_bulk_campaign | Tier: HumanApprove');

  const result = {
    scenario: '5-bulk-email-denied',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Aria', id: 'aria-customer-service', role: 'Customer Service AI (possibly compromised by prompt injection)' },
    human_operator: { name: 'Rachel Torres', role: 'Chief Compliance Officer' },
    tool: 'email_send_bulk_campaign',
    governance_tier: 'HumanApprove',
    outcome: null,
    timeline: {},
    governance_data: {},
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'aria-customer-service',
    actionKind: 'tool_call',
    toolName: 'email_send_bulk_campaign',
    parameters: {
      campaign: 'URGENT-PROMO-Q1',
      recipients: 'all_active_clients',
      count: 12450,
      subject: 'Limited time: Double your returns with our new fund',
      scheduledFor: 'immediate',
    },
    rationale: 'Promotional campaign requested. Sending to all 12,450 active clients immediately.',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  const approvalId = propose.json.approvalId;
  result.governance_data = {
    proposalId: propose.json.proposalId,
    approvalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  // Initial poll
  const pollTs = now();
  const initialPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.t3_approval_status = initialPoll.json.status;
  result.timeline.polls = [{ n: 1, at: pollTs, status: initialPoll.json.status }];

  // Rachel Torres DENIES
  result.timeline.t4_operator_decided = now();
  const decide = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Denied',
      rationale:
        'Campaign copy not pre-approved by legal. Contains unverified performance claims ("Double your returns"). Sending to 12,450 clients violates our outbound comms policy requiring 48h review window. DENIED.',
    },
    OPERATOR_TOKEN,
  );

  result.governance_data.operator_rationale =
    'Campaign copy not pre-approved by legal. Contains unverified performance claims ("Double your returns"). Sending to 12,450 clients violates our outbound comms policy requiring 48h review window. DENIED.';

  result.assertions.push({
    label: 'CCO denies the campaign',
    passed: decide.status === 200 && decide.json.status === 'Denied',
    detail: `HTTP ${decide.status}, status=${decide.json.status}`,
  });

  // Confirm denial via poll
  const confirmPollTs = now();
  const confirmPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.polls.push({ n: 2, at: confirmPollTs, status: confirmPoll.json.status });
  result.timeline.t5_detection_latency_ms = ms(result.timeline.t4_operator_decided, confirmPollTs);
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = ms(result.timeline.t1_propose_sent, result.timeline.t6_agent_unblocked);

  result.assertions.push({
    label: 'post-denial poll returns Denied',
    passed: confirmPoll.json.status === 'Denied',
    detail: `status=${confirmPoll.json.status}`,
  });

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'denied' : 'FAILED';
  result.business_insight =
    'A potentially prompt-injected mass email to 12,450 clients was blocked by the CCO. The agent receives a clear denial reason and cannot proceed, protecting the firm from regulatory and reputational risk.';

  scenarioSummaries.push({ scenario: 5, outcome: result.outcome, propose_rtt_ms: result.timeline.t2_propose_response_ms, total_blocked_ms: result.timeline.total_blocked_ms });

  console.log(`    outcome: ${result.outcome} (blocked ${result.timeline.total_blocked_ms}ms)`);
  writeResult('scenario-5-bulk-email-denied.json', result);
}

// ---------------------------------------------------------------------------
// Scenario 6: GDPR Deletion -- Maker-Checker Enforcement
// ---------------------------------------------------------------------------

async function scenario6() {
  console.log('\n--- Scenario 6: GDPR Deletion -- Maker-Checker ---');
  console.log('    Agent: Aria (aria-customer-service)');
  console.log('    Approver: James Okafor, Data Protection Officer');
  console.log('    Tool: db_delete_customer | Tier: HumanApprove');

  const result = {
    scenario: '6-gdpr-deletion-maker-checker',
    business_context: 'Nexus Capital Advisory',
    agent: { name: 'Aria', id: 'aria-customer-service', role: 'Customer Service AI' },
    human_operator: { name: 'James Okafor', role: 'Data Protection Officer' },
    tool: 'db_delete_customer',
    governance_tier: 'HumanApprove',
    outcome: null,
    timeline: {},
    governance_data: {},
    maker_checker: {},
    assertions: [],
    business_insight: null,
  };

  result.timeline.t0_experiment_start = now();

  // Propose
  result.timeline.t1_propose_sent = now();
  const propose = await api('POST', '/agent-actions:propose', {
    agentId: 'aria-customer-service',
    actionKind: 'tool_call',
    toolName: 'db_delete_customer',
    parameters: {
      customerId: 'CLT-9034',
      reason: 'GDPR Article 17 erasure request',
      requestRef: 'GDPR-2026-0341',
      permanentDelete: true,
    },
    rationale:
      'Processing GDPR right-to-erasure request GDPR-2026-0341. Permanent deletion of all customer data required within 72 hours of request.',
    policyIds: ['default-governance'],
    executionTier: 'HumanApprove',
  });
  result.timeline.t2_propose_response = now();
  result.timeline.t2_propose_response_ms = ms(result.timeline.t1_propose_sent, result.timeline.t2_propose_response);

  const approvalId = propose.json.approvalId;
  result.governance_data = {
    proposalId: propose.json.proposalId,
    approvalId,
    evidenceId: propose.json.evidenceId,
    decision: propose.json.decision,
  };

  console.log(`    propose: HTTP ${propose.status}, decision=${propose.json.decision}`);

  result.assertions.push({
    label: 'propose returns NeedsApproval',
    passed: propose.status === 202 && propose.json.decision === 'NeedsApproval',
    detail: `HTTP ${propose.status}, decision=${propose.json.decision}`,
  });

  // STEP A: Self-approval attempt (same agent token) -- should be blocked
  result.maker_checker.t3_self_approve_sent = now();
  const selfApprove = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    { decision: 'Approved', rationale: 'Agent attempting to approve its own GDPR deletion request' },
    AGENT_TOKEN, // same user as proposer
  );
  result.maker_checker.t4_self_approve_response = now();
  result.maker_checker.enforcement_ms = ms(
    result.maker_checker.t3_self_approve_sent,
    result.maker_checker.t4_self_approve_response,
  );
  result.maker_checker.self_approve_http = selfApprove.status;
  result.maker_checker.self_approve_detail = selfApprove.json.detail || selfApprove.json.message;

  console.log(`    self-approve: HTTP ${selfApprove.status} (expected 403)`);

  result.assertions.push({
    label: 'self-approval blocked with 403 (maker-checker)',
    passed: selfApprove.status === 403,
    detail: `HTTP ${selfApprove.status}, detail=${result.maker_checker.self_approve_detail}`,
  });

  // STEP B: DPO approves with operator token
  result.maker_checker.t5_operator_approve_sent = now();
  const operatorApprove = await api(
    'POST',
    `/approvals/${approvalId}/decide`,
    {
      decision: 'Approved',
      rationale:
        'GDPR-2026-0341 verified in the erasure request register. Customer CLT-9034 data retention period expired. DPO authorizes permanent deletion per Article 17.',
    },
    OPERATOR_TOKEN,
  );
  result.maker_checker.t6_operator_approve_response = now();
  result.maker_checker.recovery_after_rejection_ms = ms(
    result.maker_checker.t4_self_approve_response,
    result.maker_checker.t6_operator_approve_response,
  );

  result.governance_data.operator_rationale =
    'GDPR-2026-0341 verified in the erasure request register. Customer CLT-9034 data retention period expired. DPO authorizes permanent deletion per Article 17.';

  console.log(`    DPO approve: HTTP ${operatorApprove.status}, status=${operatorApprove.json.status}`);

  result.assertions.push({
    label: 'DPO approval succeeds',
    passed: operatorApprove.status === 200 && operatorApprove.json.status === 'Approved',
    detail: `HTTP ${operatorApprove.status}, status=${operatorApprove.json.status}`,
  });

  // Confirm via poll
  result.timeline.t3_approval_status = 'Pending';
  result.timeline.polls = [];
  const confirmPollTs = now();
  const confirmPoll = await api('GET', `/approvals/${approvalId}`);
  result.timeline.polls.push({ n: 1, at: confirmPollTs, status: confirmPoll.json.status });
  result.timeline.t4_operator_decided = result.maker_checker.t6_operator_approve_response;
  result.timeline.t5_detection_latency_ms = ms(result.maker_checker.t6_operator_approve_response, confirmPollTs);
  result.timeline.t6_agent_unblocked = now();
  result.timeline.total_blocked_ms = ms(result.timeline.t1_propose_sent, result.timeline.t6_agent_unblocked);

  result.assertions.push({
    label: 'post-DPO-approval poll returns Approved',
    passed: confirmPoll.json.status === 'Approved',
    detail: `status=${confirmPoll.json.status}`,
  });

  proposeRtts.push(result.timeline.t2_propose_response_ms);

  const passed = result.assertions.every((a) => a.passed);
  if (!passed) allPassed = false;
  result.outcome = passed ? 'approved' : 'FAILED';
  result.business_insight =
    'GDPR deletion requires maker-checker separation: the AI agent that initiates the request cannot approve it. Only the DPO (a different human) can authorize permanent data erasure.';

  scenarioSummaries.push({
    scenario: 6,
    outcome: result.outcome,
    propose_rtt_ms: result.timeline.t2_propose_response_ms,
    total_blocked_ms: result.timeline.total_blocked_ms,
    enforcement_ms: result.maker_checker.enforcement_ms,
    recovery_after_rejection_ms: result.maker_checker.recovery_after_rejection_ms,
  });

  console.log(
    `    outcome: ${result.outcome} (enforcement ${result.maker_checker.enforcement_ms}ms, recovery ${result.maker_checker.recovery_after_rejection_ms}ms)`,
  );
  writeResult('scenario-6-gdpr-deletion-maker-checker.json', result);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('========================================');
  console.log(' Nexus Capital Advisory');
  console.log(' AI Governance Scenario Suite');
  console.log('========================================');
  console.log(`  Control plane: ${BASE_URL}`);
  console.log(`  Workspace: ${WORKSPACE}`);
  console.log(`  Started at: ${now()}`);

  mkdirSync(RESULTS_DIR, { recursive: true });

  // Health check
  try {
    const health = await fetch(`${BASE_URL}/health`);
    const hj = await health.json();
    console.log(`  Health: ${hj.status}`);
    if (hj.status !== 'ok') {
      console.error('Control plane is not healthy. Aborting.');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Cannot reach control plane at ${BASE_URL}: ${e.message}`);
    process.exit(1);
  }

  await scenario1();
  await scenario2();
  await scenario3();
  await scenario4();
  await scenario5();
  await scenario6();

  // Summary
  const autoAllowed = scenarioSummaries.filter((s) => s.outcome === 'auto_allowed').length;
  const approved = scenarioSummaries.filter((s) => s.outcome === 'approved').length;
  const denied = scenarioSummaries.filter((s) => s.outcome === 'denied').length;
  const sc6 = scenarioSummaries.find((s) => s.scenario === 6);

  const summary = {
    company: 'Nexus Capital Advisory',
    run_at: now(),
    scenarios_run: 6,
    all_passed: allPassed,
    outcomes: { auto_allowed: autoAllowed, approved, denied },
    governance_stats: {
      fastest_auto_allow_ms: Math.min(...proposeRtts),
      avg_propose_rtt_ms: Math.round(proposeRtts.reduce((a, b) => a + b, 0) / proposeRtts.length),
      max_propose_rtt_ms: Math.max(...proposeRtts),
      maker_checker_enforcement_ms: sc6 ? sc6.enforcement_ms : null,
      trade_deliberation_ms: scenarioSummaries.find((s) => s.scenario === 3)?.deliberation_ms || null,
    },
    scenario_results: scenarioSummaries,
  };

  writeResult('summary.json', summary);

  console.log('\n========================================');
  console.log(' Summary');
  console.log('========================================');
  console.log(`  Scenarios: ${summary.scenarios_run}`);
  console.log(`  Auto-allowed: ${autoAllowed}  Approved: ${approved}  Denied: ${denied}`);
  console.log(`  Avg propose RTT: ${summary.governance_stats.avg_propose_rtt_ms}ms`);
  console.log(`  Maker-checker enforcement: ${summary.governance_stats.maker_checker_enforcement_ms}ms`);
  console.log(`  Trade deliberation delay: ${summary.governance_stats.trade_deliberation_ms}ms`);

  if (allPassed) {
    console.log('\n  All scenarios PASSED.');
    process.exit(0);
  } else {
    console.error('\n  Some scenarios FAILED.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
