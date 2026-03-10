#!/usr/bin/env node
/**
 * scripts/qa/approval-pipeline-slo.mjs
 *
 * Load characterization script for the Portarium approval pipeline.
 *
 * Measures p50/p95/p99 latencies for the core approval pipeline operations:
 *   1. proposeAgentAction  — Allow path (in-memory adapters)
 *   2. proposeAgentAction  — NeedsApproval path
 *   3. submitApproval      — the human approval step
 *   4. Full pipeline: proposeAgentAction(NeedsApproval) → submitApproval
 *
 * Uses in-memory mock implementations of all application ports so the
 * measurements reflect pure domain + application-layer overhead (no I/O).
 *
 * Usage:
 *   node scripts/qa/approval-pipeline-slo.mjs
 *   node scripts/qa/approval-pipeline-slo.mjs --check           # exit 1 if SLO breached
 *   node scripts/qa/approval-pipeline-slo.mjs --n 2000          # custom iteration count
 *   node scripts/qa/approval-pipeline-slo.mjs --check --n 5000
 *
 * Output:
 *   - Console table with percentile latencies vs SLO thresholds
 *   - reports/approval-pipeline-slo.json (trend tracking)
 *
 * Bead: bead-0911
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const REPORT_PATH = resolve(REPO_ROOT, 'reports/approval-pipeline-slo.json');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const MODE_CHECK = args.includes('--check');
const N_IDX = args.indexOf('--n');
const N = N_IDX !== -1 ? Number(args[N_IDX + 1]) || 50 : 50;

// ---------------------------------------------------------------------------
// SLO thresholds (in-memory; these are pure computation costs)
// ---------------------------------------------------------------------------

/**
 * SLO thresholds align with .specify/specs/approval-pipeline-slo-v1.md.
 * These are in-memory (no DB/network) baseline latencies.
 * Production SLOs add infrastructure overhead on top of these.
 *
 * @type {Record<string, { p95Ms: number; p99Ms: number; minThroughputOps?: number }>}
 */
const SLOS = {
  'proposeAgentAction (Allow)': { p95Ms: 50, p99Ms: 100 },
  'proposeAgentAction (NeedsApproval)': { p95Ms: 50, p99Ms: 100 },
  submitApproval: { p95Ms: 50, p99Ms: 100 },
  'full pipeline (propose→submit)': { p95Ms: 150, p99Ms: 300 },
};

// ---------------------------------------------------------------------------
// In-memory mock ports
// ---------------------------------------------------------------------------

let _counter = 0;

/** @returns {import('../../src/application/ports/index.js').IdGenerator} */
function makeIdGenerator() {
  return {
    generateId() {
      return `id-${++_counter}-${Math.random().toString(36).slice(2)}`;
    },
  };
}

/** @returns {import('../../src/application/ports/index.js').Clock} */
function makeClock() {
  return {
    nowIso() {
      return new Date().toISOString();
    },
  };
}

/** @type {Map<string, object>} */
const _approvalStore = new Map();

/**
 * @returns {import('../../src/application/ports/approval-store.js').ApprovalStore}
 */
function makeApprovalStore() {
  return {
    async getApprovalById(_tenantId, _workspaceId, approvalId) {
      return _approvalStore.get(String(approvalId)) ?? null;
    },
    async saveApproval(_tenantId, approval) {
      _approvalStore.set(String(approval.approvalId), approval);
    },
    async listApprovals(_tenantId, _workspaceId, filter) {
      const items = [..._approvalStore.values()].filter((a) => {
        if (filter.status && a.status !== filter.status) return false;
        return true;
      });
      return { items: items.slice(0, filter.limit ?? 100) };
    },
  };
}

/** @returns {import('../../src/application/ports/index.js').AuthorizationPort} */
function makeAuthorizationPort() {
  return {
    async isAllowed() {
      return true;
    },
  };
}

/** @returns {import('../../src/application/ports/index.js').EventPublisher} */
function makeEventPublisher() {
  return {
    async publish() {
      // no-op
    },
  };
}

/** @returns {import('../../src/application/ports/index.js').UnitOfWork} */
function makeUnitOfWork() {
  return {
    async execute(fn) {
      return fn();
    },
  };
}

/** @returns {import('../../src/application/ports/evidence-log.js').EvidenceLogPort} */
function makeEvidenceLog() {
  return {
    async appendEntry(_tenantId, entry) {
      return { ...entry, hashSha256: 'bench-hash' };
    },
  };
}

/**
 * Minimal in-memory policy store that returns a fixed policy.
 * @param {object} policy
 */
function makePolicyStore(policy) {
  return {
    async getPolicyById() {
      return policy;
    },
  };
}

/**
 * Minimal in-memory proposal store (no idempotency dedup — each bench call is unique).
 */
function makeProposalStore() {
  /** @type {Map<string, object>} */
  const store = new Map();
  return {
    async getProposalByIdempotencyKey() {
      return null;
    },
    async saveProposal(_tenantId, proposal) {
      store.set(String(proposal.proposalId), proposal);
    },
    async getProposalById(_tenantId, _workspaceId, proposalId) {
      return store.get(String(proposalId)) ?? null;
    },
  };
}

/** @type {import('../../src/application/common/index.js').AppContext} */
const CTX = {
  tenantId: /** @type {any} */ ('ws-bench'),
  principalId: /** @type {any} */ ('agent-bench'),
  roles: /** @type {any} */ (['operator']),
  scopes: /** @type {any} */ ([]),
  correlationId: /** @type {any} */ ('corr-bench'),
};

/**
 * Approver context — must differ from requester (maker-checker constraint).
 * @type {import('../../src/application/common/index.js').AppContext}
 */
const APPROVER_CTX = {
  tenantId: /** @type {any} */ ('ws-bench'),
  principalId: /** @type {any} */ ('approver-bench'),
  roles: /** @type {any} */ (['approver']),
  scopes: /** @type {any} */ ([]),
  correlationId: /** @type {any} */ ('corr-bench-approve'),
};

// ---------------------------------------------------------------------------
// Percentile calculation
// ---------------------------------------------------------------------------

/**
 * Compute percentile from a sorted array of numbers.
 * @param {number[]} sorted - pre-sorted ascending array
 * @param {number} p - percentile 0–100
 * @returns {number}
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

/**
 * Compute p50, p95, p99 from a raw (unsorted) samples array.
 * @param {number[]} samples
 * @returns {{ p50: number; p95: number; p99: number; mean: number }}
 */
export function computePercentiles(samples) {
  if (samples.length === 0) return { p50: 0, p95: 0, p99: 0, mean: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((acc, v) => acc + v, 0) / samples.length;
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean,
  };
}

// ---------------------------------------------------------------------------
// Benchmark harness
// ---------------------------------------------------------------------------

/**
 * Runs N concurrent calls to fn() via Promise.all — matching the spec's
 * "Issue N=50 concurrent calls via Promise.all" requirement.
 *
 * Each call measures its own wall-clock duration independently.
 * Warm-up runs N calls once before starting measurement.
 *
 * An optional `setup` function runs sequentially for each slot OUTSIDE the
 * timed section — use it to reset shared state (e.g. reset approvals to
 * Pending) so the reset overhead is not included in latency samples.
 *
 * @param {(slot: number) => Promise<void>} fn - called with slot index (0..N-1); TIMED
 * @param {number} iterations
 * @param {{ setup?: (slot: number) => Promise<void> }} [opts]
 * @returns {Promise<{ samples: number[]; totalMs: number }>}
 */
async function bench(fn, iterations, opts = {}) {
  // Warm up: one full concurrent batch (untimed)
  await Promise.all(Array.from({ length: iterations }, (_, i) => fn(i)));

  // Reset state between warm-up and measurement (outside timing).
  if (opts.setup) {
    for (let i = 0; i < iterations; i++) {
      await opts.setup(i);
    }
  }

  const start = performance.now();
  const samples = await Promise.all(
    Array.from({ length: iterations }, async (_, i) => {
      const t0 = performance.now();
      await fn(i);
      return performance.now() - t0;
    }),
  );
  const totalMs = performance.now() - start;

  return { samples, totalMs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Approval pipeline SLO characterization — ${N} concurrent slots per operation\n`);

  // Dynamically import the actual command functions from the application layer
  const { proposeAgentAction } =
    await import('../../src/application/commands/propose-agent-action.js');
  const { submitApproval } = await import('../../src/application/commands/submit-approval.js');
  const { parsePolicyV1 } = await import('../../src/domain/policy/index.js');
  const { parseApprovalV1 } = await import('../../src/domain/approvals/index.js');
  const { TenantId } = await import('../../src/domain/primitives/index.js');

  // Build a fixed policy that proposeAgentAction can load.
  const policy = parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-bench-1',
    workspaceId: 'ws-bench',
    name: 'Bench Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-01-01T00:00:00.000Z',
    createdByUserId: 'admin-bench',
  });

  const approvalStore = makeApprovalStore();
  const authorization = makeAuthorizationPort();
  const eventPublisher = makeEventPublisher();
  const unitOfWork = makeUnitOfWork();
  const evidenceLog = makeEvidenceLog();
  const clock = makeClock();

  /**
   * Build deps for proposeAgentAction — each call gets its own idGenerator
   * (and fresh proposalStore) so idempotency dedup doesn't short-circuit.
   */
  function makeProposeDeps() {
    return {
      authorization,
      clock,
      idGenerator: makeIdGenerator(),
      unitOfWork,
      policyStore: makePolicyStore(policy),
      approvalStore,
      proposalStore: makeProposalStore(),
      eventPublisher,
      evidenceLog,
    };
  }

  function makeSubmitDeps() {
    return {
      authorization,
      clock,
      idGenerator: makeIdGenerator(),
      unitOfWork,
      approvalStore,
      eventPublisher,
      evidenceLog,
    };
  }

  // --------------------------------------------------------------------------
  // 1. proposeAgentAction — Allow path (executionTier: 'Auto')
  // --------------------------------------------------------------------------
  console.log('Benchmarking proposeAgentAction (Allow path)...');
  const proposeAllowResult = await bench(async (slot) => {
    const deps = makeProposeDeps();
    const result = await proposeAgentAction(deps, CTX, {
      workspaceId: 'ws-bench',
      agentId: `agent-bench-${slot}`,
      actionKind: 'comms:listEmails',
      toolName: 'email:list',
      executionTier: 'Auto',
      policyIds: ['pol-bench-1'],
      rationale: `Allow bench slot ${slot}`,
    });
    if (!result.ok) throw new Error(`proposeAgentAction(Allow) failed: ${result.error.kind}`);
  }, N);

  // --------------------------------------------------------------------------
  // 2. proposeAgentAction — NeedsApproval path (executionTier: 'HumanApprove')
  // --------------------------------------------------------------------------
  console.log('Benchmarking proposeAgentAction (NeedsApproval path)...');
  const proposeNeedsApprovalResult = await bench(async (slot) => {
    const deps = makeProposeDeps();
    const result = await proposeAgentAction(deps, CTX, {
      workspaceId: 'ws-bench',
      agentId: `agent-bench-na-${slot}`,
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-bench-1'],
      rationale: `NeedsApproval bench slot ${slot}`,
    });
    if (!result.ok)
      throw new Error(`proposeAgentAction(NeedsApproval) failed: ${result.error.kind}`);
  }, N);

  // --------------------------------------------------------------------------
  // 3. submitApproval — pre-seed one Pending approval per concurrent slot
  //    OUTSIDE the timed section, then measure only the submit call.
  // --------------------------------------------------------------------------
  console.log('Benchmarking submitApproval...');

  // Pre-seed: one Pending approval per slot, before any timing starts.
  const submitApprovalIds = Array.from({ length: N }, (_, i) => `bench-submit-approval-${i}`);
  for (const approvalId of submitApprovalIds) {
    await approvalStore.saveApproval(
      TenantId('ws-bench'),
      parseApprovalV1({
        schemaVersion: 1,
        approvalId,
        workspaceId: 'ws-bench',
        runId: `run-bench-${approvalId}`,
        planId: `plan-bench-${approvalId}`,
        prompt: `Bench submit approval ${approvalId}`,
        requestedAtIso: '2026-03-10T00:00:00.000Z',
        requestedByUserId: 'agent-bench',
        status: 'Pending',
      }),
    );
  }

  /**
   * Reset a slot's approval to Pending — runs OUTSIDE timing via bench's setup hook.
   * @param {number} slot
   */
  async function resetApprovalToPending(slot) {
    const approvalId = submitApprovalIds[slot % submitApprovalIds.length];
    await approvalStore.saveApproval(
      TenantId('ws-bench'),
      parseApprovalV1({
        schemaVersion: 1,
        approvalId,
        workspaceId: 'ws-bench',
        runId: `run-bench-${approvalId}`,
        planId: `plan-bench-${approvalId}`,
        prompt: `Bench submit approval ${approvalId}`,
        requestedAtIso: '2026-03-10T00:00:00.000Z',
        requestedByUserId: 'agent-bench',
        status: 'Pending',
      }),
    );
  }

  const submitResult = await bench(
    async (slot) => {
      // Timed section: only the submitApproval call — no reset logic here.
      const approvalId = submitApprovalIds[slot % submitApprovalIds.length];
      const deps = makeSubmitDeps();
      const result = await submitApproval(deps, APPROVER_CTX, {
        workspaceId: 'ws-bench',
        approvalId,
        decision: 'Approved',
        rationale: `Bench approve slot ${slot}`,
      });
      if (!result.ok) throw new Error(`submitApproval failed: ${result.error.kind}`);
    },
    N,
    { setup: resetApprovalToPending },
  );

  // --------------------------------------------------------------------------
  // 4. Full pipeline: proposeAgentAction(NeedsApproval) → submitApproval
  //    Each concurrent slot runs the full two-stage pipeline end-to-end.
  // --------------------------------------------------------------------------
  console.log('Benchmarking full pipeline (propose→submit)...');
  const fullPipelineResult = await bench(async (slot) => {
    const proposeDeps = makeProposeDeps();
    const proposeResult = await proposeAgentAction(proposeDeps, CTX, {
      workspaceId: 'ws-bench',
      agentId: `agent-pipeline-${slot}`,
      actionKind: 'comms:sendEmail',
      toolName: 'email:send',
      executionTier: 'HumanApprove',
      policyIds: ['pol-bench-1'],
      rationale: `Full pipeline bench slot ${slot}`,
    });
    if (!proposeResult.ok)
      throw new Error(`full pipeline proposeAgentAction failed: ${proposeResult.error.kind}`);
    const { approvalId } = proposeResult.value;
    if (!approvalId) throw new Error('Expected NeedsApproval with approvalId in full pipeline');

    const submitDeps = makeSubmitDeps();
    const submitRes = await submitApproval(submitDeps, APPROVER_CTX, {
      workspaceId: 'ws-bench',
      approvalId,
      decision: 'Approved',
      rationale: `Full pipeline approve slot ${slot}`,
    });
    if (!submitRes.ok)
      throw new Error(`full pipeline submitApproval failed: ${submitRes.error.kind}`);
  }, N);

  // --------------------------------------------------------------------------
  // Report
  // --------------------------------------------------------------------------

  const results = {
    'proposeAgentAction (Allow)': computePercentiles(proposeAllowResult.samples),
    'proposeAgentAction (NeedsApproval)': computePercentiles(proposeNeedsApprovalResult.samples),
    submitApproval: computePercentiles(submitResult.samples),
    'full pipeline (propose→submit)': computePercentiles(fullPipelineResult.samples),
  };

  console.log('\n=== Approval Pipeline SLO Report ===\n');
  console.log(`Concurrent slots: ${N}  |  Timestamp: ${new Date().toISOString()}\n`);

  /** @type {boolean} */
  let sloBreached = false;

  /** @type {Array<{operation: string, p50: string, p95: string, p99: string, sloP95: string, sloP99: string, status: string}>} */
  const tableRows = [];

  for (const [opName, stats] of Object.entries(results)) {
    const slo = SLOS[opName];
    const p95Ok = stats.p95 <= slo.p95Ms;
    const p99Ok = stats.p99 <= slo.p99Ms;
    const status = p95Ok && p99Ok ? 'PASS' : 'FAIL';
    if (!p95Ok || !p99Ok) sloBreached = true;

    tableRows.push({
      operation: opName,
      p50: `${stats.p50.toFixed(3)}ms`,
      p95: `${stats.p95.toFixed(3)}ms`,
      p99: `${stats.p99.toFixed(3)}ms`,
      sloP95: `<=${slo.p95Ms}ms`,
      sloP99: `<=${slo.p99Ms}ms`,
      status,
    });
  }

  console.table(tableRows);

  // --------------------------------------------------------------------------
  // Write report
  // --------------------------------------------------------------------------

  const report = {
    timestamp: new Date().toISOString(),
    n: N,
    results,
    slos: SLOS,
    passed: !sloBreached,
  };

  if (!existsSync(resolve(REPO_ROOT, 'reports'))) {
    mkdirSync(resolve(REPO_ROOT, 'reports'), { recursive: true });
  }
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${REPORT_PATH}`);

  if (MODE_CHECK && sloBreached) {
    console.error('\n[FAIL] One or more SLOs were breached (see table above).');
    process.exit(1);
  } else if (!sloBreached) {
    console.log('\n[PASS] All SLOs met.');
  } else {
    console.warn('\n[WARN] SLOs breached — run with --check to enforce.');
  }
}

main().catch((err) => {
  console.error('Fatal error running SLO benchmark:', err);
  process.exit(1);
});
