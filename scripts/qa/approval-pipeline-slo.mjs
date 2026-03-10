#!/usr/bin/env node
/**
 * scripts/qa/approval-pipeline-slo.mjs
 *
 * Load characterization script for the Portarium approval pipeline.
 *
 * Measures p50/p95/p99 latencies for the core approval pipeline operations:
 *   1. createApproval  — propose a new approval (Pending)
 *   2. submitApproval  — decide on an approval (Approved / Denied)
 *   3. sweepExpiredApprovals — expire pending approvals via scheduler
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
const N = N_IDX !== -1 ? Number(args[N_IDX + 1]) || 1000 : 1000;

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
  createApproval: { p95Ms: 50, p99Ms: 100, minThroughputOps: 200 },
  submitApproval: { p95Ms: 50, p99Ms: 100 },
  sweepExpiredApprovals: { p95Ms: 50, p99Ms: 100 },
};

// ---------------------------------------------------------------------------
// In-memory mock ports
// ---------------------------------------------------------------------------

let _counter = 0;

/** @returns {import('../../src/application/ports/index.js').IdGenerator} */
function makeIdGenerator() {
  return {
    generateId() {
      return `id-${++_counter}-${Date.now()}`;
    },
  };
}

/** @returns {import('../../src/application/ports/index.js').Clock} */
function makeClock(nowMs = Date.now()) {
  return {
    nowIso() {
      return new Date(nowMs).toISOString();
    },
  };
}

/** @type {Map<string, object>} */
const _approvalStore = new Map();

/**
 * @returns {import('../../src/application/ports/approval-store.js').ApprovalStore
 *   & import('../../src/application/ports/approval-store.js').ApprovalQueryStore}
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
    async appendEntry() {
      // no-op
    },
  };
}

/** @type {import('../../src/application/common/index.js').AppContext} */
const CTX = {
  tenantId: /** @type {any} */ ('tenant-bench'),
  principalId: /** @type {any} */ ('user-requester'),
  roles: /** @type {any} */ ([]),
  scopes: /** @type {any} */ ([]),
  correlationId: /** @type {any} */ ('corr-bench'),
};

/**
 * Approver context — must differ from requester (maker-checker constraint).
 * @type {import('../../src/application/common/index.js').AppContext}
 */
const APPROVER_CTX = {
  tenantId: /** @type {any} */ ('tenant-bench'),
  principalId: /** @type {any} */ ('user-approver'),
  roles: /** @type {any} */ ([]),
  scopes: /** @type {any} */ ([]),
  correlationId: /** @type {any} */ ('corr-bench'),
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
 * @param {() => Promise<void>} fn
 * @param {number} iterations
 * @returns {Promise<{ samples: number[]; totalMs: number }>}
 */
async function bench(fn, iterations) {
  // Warm up (10% of iterations, min 10)
  const warmup = Math.max(10, Math.floor(iterations * 0.1));
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  const samples = [];
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const totalMs = performance.now() - start;

  return { samples, totalMs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Approval pipeline SLO characterization — ${N} iterations per operation\n`);

  // Dynamically import the actual command functions from the application layer
  const { createApproval } = await import('../../src/application/commands/create-approval.js');
  const { submitApproval } = await import('../../src/application/commands/submit-approval.js');
  const { sweepExpiredApprovals } =
    await import('../../src/application/commands/sweep-expired-approvals.js');

  const idGen = makeIdGenerator();
  const clock = makeClock();
  const approvalStore = makeApprovalStore();
  const authorization = makeAuthorizationPort();
  const eventPublisher = makeEventPublisher();
  const unitOfWork = makeUnitOfWork();
  const evidenceLog = makeEvidenceLog();

  const createDeps = {
    idGenerator: idGen,
    clock,
    approvalStore,
    authorization,
    eventPublisher,
    unitOfWork,
    evidenceLog,
  };

  // Pre-create approvals for submit benchmark
  /** @type {string[]} */
  const approvalIds = [];
  for (let i = 0; i < N; i++) {
    const result = await createApproval(createDeps, CTX, {
      workspaceId: String(CTX.tenantId),
      runId: `run-seed-${i}`,
      planId: `plan-seed-${i}`,
      prompt: `Approve action ${i}`,
    });
    if (result.ok) approvalIds.push(String(result.value.approvalId));
  }

  // --------------------------------------------------------------------------
  // 1. createApproval
  // --------------------------------------------------------------------------
  console.log('Benchmarking createApproval...');
  const createResult = await bench(async () => {
    await createApproval(createDeps, CTX, {
      workspaceId: String(CTX.tenantId),
      runId: `run-${idGen.generateId()}`,
      planId: `plan-${idGen.generateId()}`,
      prompt: 'Load test approval prompt — please approve this agent action.',
    });
  }, N);

  // --------------------------------------------------------------------------
  // 2. submitApproval (Approve)
  // --------------------------------------------------------------------------
  console.log('Benchmarking submitApproval...');
  let submitIdx = 0;
  const submitDeps = {
    idGenerator: idGen,
    clock,
    approvalStore,
    authorization,
    eventPublisher,
    unitOfWork,
    evidenceLog,
  };

  const submitResult = await bench(async () => {
    const approvalId = approvalIds[submitIdx % approvalIds.length];
    submitIdx++;
    // Re-save as Pending so we can submit it again (reset for bench)
    const existing = await approvalStore.getApprovalById(
      /** @type {any} */ (CTX.tenantId),
      /** @type {any} */ (CTX.tenantId),
      /** @type {any} */ (approvalId),
    );
    if (existing) {
      await approvalStore.saveApproval(/** @type {any} */ (CTX.tenantId), {
        ...existing,
        status: 'Pending',
        decidedAtIso: undefined,
        decidedByUserId: undefined,
        rationale: undefined,
      });
    }
    await submitApproval(submitDeps, APPROVER_CTX, {
      workspaceId: String(CTX.tenantId),
      approvalId: String(approvalId),
      decision: 'Approved',
      rationale: 'Load test approval — approved.',
    });
  }, N);

  // --------------------------------------------------------------------------
  // 3. sweepExpiredApprovals
  // --------------------------------------------------------------------------
  console.log('Benchmarking sweepExpiredApprovals...');

  // Seed approvals that are past their due date
  const pastClock = makeClock(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
  const expiredSeedDeps = { ...createDeps, clock: pastClock };
  const expiredIds = [];
  const SWEEP_BATCH = Math.min(N, 50);
  for (let i = 0; i < SWEEP_BATCH; i++) {
    const r = await createApproval(expiredSeedDeps, CTX, {
      workspaceId: String(CTX.tenantId),
      runId: `run-exp-${i}`,
      planId: `plan-exp-${i}`,
      prompt: `Expiring approval ${i}`,
      dueAtIso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    if (r.ok) expiredIds.push(String(r.value.approvalId));
  }

  const sweepDeps = {
    idGenerator: idGen,
    clock,
    approvalStore,
    eventPublisher,
    evidenceLog,
  };

  const sweepResult = await bench(
    async () => {
      // Reset expired approvals to Pending before each sweep so sweep has work to do
      for (const eid of expiredIds) {
        const existing = await approvalStore.getApprovalById(
          /** @type {any} */ (CTX.tenantId),
          /** @type {any} */ (CTX.tenantId),
          /** @type {any} */ (eid),
        );
        if (existing) {
          await approvalStore.saveApproval(/** @type {any} */ (CTX.tenantId), {
            ...existing,
            status: 'Pending',
            decidedAtIso: undefined,
            decidedByUserId: undefined,
            rationale: undefined,
          });
        }
      }
      await sweepExpiredApprovals(sweepDeps, {
        workspaceId: String(CTX.tenantId),
        correlationId: 'corr-sweep',
      });
    },
    Math.min(N, 200),
  );

  // --------------------------------------------------------------------------
  // Report
  // --------------------------------------------------------------------------

  const results = {
    createApproval: computePercentiles(createResult.samples),
    submitApproval: computePercentiles(submitResult.samples),
    sweepExpiredApprovals: computePercentiles(sweepResult.samples),
  };

  const createThroughput = (N / createResult.totalMs) * 1000;

  console.log('\n=== Approval Pipeline SLO Report ===\n');
  console.log(`Iterations: ${N}  |  Timestamp: ${new Date().toISOString()}\n`);

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

  // Throughput row
  const tpSlo = SLOS.createApproval.minThroughputOps ?? 0;
  const tpOk = createThroughput >= tpSlo;
  if (!tpOk) sloBreached = true;
  console.log(
    `\ncreatApproval throughput: ${createThroughput.toFixed(0)} ops/sec  (SLO: >=${tpSlo})  [${tpOk ? 'PASS' : 'FAIL'}]`,
  );

  // --------------------------------------------------------------------------
  // Write report
  // --------------------------------------------------------------------------

  const report = {
    timestamp: new Date().toISOString(),
    n: N,
    results,
    throughput: { createApproval: createThroughput },
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
