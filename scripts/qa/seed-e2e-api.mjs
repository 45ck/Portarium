#!/usr/bin/env node
/**
 * scripts/qa/seed-e2e-api.mjs
 *
 * Seeds the Portarium control plane API with deterministic E2E test data:
 *   - E2E workspace (ws-e2e)
 *   - Default policy bundle
 *   - Sample workflow run (run-e2e-001)
 *   - Pending approval request (approval-e2e-001)
 *
 * Idempotent: skips resources that already exist (200/409 handled).
 *
 * Usage:
 *   node scripts/qa/seed-e2e-api.mjs
 *
 * Environment:
 *   API_URL                      — default: http://localhost:8080
 *   PORTARIUM_SEED_WORKSPACE_ID  — default: ws-e2e
 *   PORTARIUM_API_TOKEN          — optional bearer token for auth
 *
 * Bead: bead-0829
 */

const API_URL = process.env['API_URL'] ?? 'http://localhost:8080';
const WORKSPACE_ID = process.env['PORTARIUM_SEED_WORKSPACE_ID'] ?? 'ws-e2e';
const API_TOKEN = process.env['PORTARIUM_API_TOKEN'] ?? '';

function authHeaders() {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    process.stdout.write(`[seed-e2e-api] ${path} already exists — skipping.\n`);
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status} ${text}`);
  }
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function healthCheck() {
  const res = await fetch(`${API_URL}/health`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`API health check failed: HTTP ${res.status}`);
  process.stdout.write('[seed-e2e-api] API is healthy.\n');
}

async function ensureWorkspace() {
  const existing = await apiGet(`/api/v1/workspaces/${WORKSPACE_ID}`);
  if (existing) {
    process.stdout.write(`[seed-e2e-api] Workspace ${WORKSPACE_ID} already exists.\n`);
    return;
  }
  const result = await apiPost('/api/v1/workspaces', {
    id: WORKSPACE_ID,
    name: 'E2E Test Workspace',
    description: 'Deterministic workspace for Playwright E2E test runs',
  });
  if (result) {
    process.stdout.write(`[seed-e2e-api] Created workspace ${WORKSPACE_ID}.\n`);
  }
}

async function ensurePolicy() {
  const policyId = `pol-e2e-default`;
  const existing = await apiGet(`/api/v1/workspaces/${WORKSPACE_ID}/policies/${policyId}`);
  if (existing) {
    process.stdout.write(`[seed-e2e-api] Policy ${policyId} already exists.\n`);
    return;
  }
  const result = await apiPost(`/api/v1/workspaces/${WORKSPACE_ID}/policies`, {
    id: policyId,
    name: 'E2E Default Policy',
    rules: [
      {
        id: 'rule-e2e-approval-required',
        type: 'approval_required',
        condition: { action: '*' },
        approvers: ['e2e-approver'],
      },
    ],
  });
  if (result) {
    process.stdout.write(`[seed-e2e-api] Created policy ${policyId}.\n`);
  }
}

async function ensureWorkflowRun() {
  const runId = 'run-e2e-001';
  const existing = await apiGet(`/api/v1/workspaces/${WORKSPACE_ID}/runs/${runId}`);
  if (existing) {
    process.stdout.write(`[seed-e2e-api] Run ${runId} already exists.\n`);
    return;
  }
  const result = await apiPost(`/api/v1/workspaces/${WORKSPACE_ID}/runs`, {
    id: runId,
    name: 'E2E Smoke Run',
    type: 'manual',
    status: 'pending',
    triggeredBy: 'e2e-operator',
  });
  if (result) {
    process.stdout.write(`[seed-e2e-api] Created run ${runId}.\n`);
  }
}

async function ensureApprovalRequest() {
  const approvalId = 'approval-e2e-001';
  const existing = await apiGet(`/api/v1/workspaces/${WORKSPACE_ID}/approvals/${approvalId}`);
  if (existing) {
    process.stdout.write(`[seed-e2e-api] Approval ${approvalId} already exists.\n`);
    return;
  }
  const result = await apiPost(`/api/v1/workspaces/${WORKSPACE_ID}/approvals`, {
    id: approvalId,
    runId: 'run-e2e-001',
    requestedBy: 'e2e-operator',
    requestedAt: new Date().toISOString(),
    status: 'pending',
    description: 'E2E test approval request',
  });
  if (result) {
    process.stdout.write(`[seed-e2e-api] Created approval request ${approvalId}.\n`);
  }
}

async function main() {
  process.stdout.write(`[seed-e2e-api] Seeding ${API_URL} (workspace=${WORKSPACE_ID})...\n`);
  await healthCheck();
  await ensureWorkspace();
  await ensurePolicy();
  await ensureWorkflowRun();
  await ensureApprovalRequest();
  process.stdout.write('[seed-e2e-api] Done — E2E API state ready.\n');
}

main().catch((err) => {
  process.stderr.write(`[seed-e2e-api] ERROR: ${err.message}\n`);
  process.exit(1);
});
