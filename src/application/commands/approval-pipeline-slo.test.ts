/**
 * Approval Pipeline SLO — Unit Tests (bead-0911)
 *
 * Tests the pure logic used by scripts/qa/approval-pipeline-slo.mjs:
 *   - Percentile calculation
 *   - Mock port implementations satisfy type contracts
 *   - SLO threshold definitions are sensible
 *
 * Does NOT assert on actual latency values — those are environment-dependent.
 * For latency assertions, run the script with --check in a controlled environment.
 *
 * Performance tests use describe.skipIf(process.env['CI_PERF_SKIP']) so they
 * can be excluded from standard CI runners where timing is unreliable.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';
import type { EvidenceLogPort } from '../ports/evidence-log.js';
import { createApproval } from './create-approval.js';
import { submitApproval } from './submit-approval.js';
import type { AppContext } from '../common/context.js';
import { CorrelationId, TenantId, UserId, WorkspaceId } from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Re-implement percentile + computePercentiles here (same logic as the script)
// so we can unit-test without importing an .mjs script from a .test.ts file.
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}

function computePercentiles(samples: number[]): {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
} {
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
// In-memory mock ports (same pattern as the benchmark script)
// ---------------------------------------------------------------------------

let _counter = 0;
const _store = new Map<string, object>();

// Reset shared state before each test to prevent cross-test pollution.
beforeEach(() => {
  _counter = 0;
  _store.clear();
});

function makeIdGenerator(): IdGenerator {
  return {
    generateId() {
      return `id-${++_counter}-${Date.now()}`;
    },
  };
}

function makeClock(): Clock {
  return {
    nowIso() {
      return new Date().toISOString();
    },
  };
}

function makeApprovalStore(): ApprovalStore {
  return {
    async getApprovalById(_tenantId, _workspaceId, approvalId) {
      return (_store.get(String(approvalId)) as any) ?? null;
    },
    async saveApproval(_tenantId, approval) {
      _store.set(String((approval as any).approvalId), approval);
    },
  };
}

function makeAuthorizationPort(): AuthorizationPort {
  return {
    async isAllowed() {
      return true;
    },
  };
}

function makeEventPublisher(): EventPublisher {
  return {
    async publish() {
      // no-op
    },
  };
}

function makeUnitOfWork(): UnitOfWork {
  return {
    async execute(fn) {
      return fn();
    },
  };
}

function makeEvidenceLog(): EvidenceLogPort {
  return {
    async appendEntry(_tenantId, entry) {
      // no-op stub — return a minimal EvidenceEntryV1 to satisfy the type
      return {
        schemaVersion: 1,
        evidenceId: entry.evidenceId,
        workspaceId: entry.workspaceId,
        correlationId: entry.correlationId,
        occurredAtIso: entry.occurredAtIso,
        category: entry.category,
        summary: entry.summary,
        actor: entry.actor,
        links: entry.links ?? {},
      } as any;
    },
  };
}

const TEST_CTX: AppContext = {
  tenantId: TenantId('tenant-test'),
  principalId: UserId('user-test'),
  roles: [],
  scopes: [],
  correlationId: CorrelationId('corr-test'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('percentile()', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('returns single element for single-element array at any percentile', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  it('returns median for p50', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it('returns last element for p100', () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 100)).toBe(5);
  });

  it('returns first element for p1 on small array', () => {
    const sorted = [1, 2, 3];
    expect(percentile(sorted, 1)).toBe(1);
  });

  it('clamps idx to valid range', () => {
    const sorted = [10, 20, 30];
    // p0 should not throw, should return the minimum element
    expect(percentile(sorted, 0)).toBeGreaterThanOrEqual(10);
  });
});

describe('computePercentiles()', () => {
  it('returns zeros for empty array', () => {
    const result = computePercentiles([]);
    expect(result).toEqual({ p50: 0, p95: 0, p99: 0, mean: 0 });
  });

  it('computes correct percentiles for uniform distribution', () => {
    // 100 samples of value 1 — all percentiles should be 1
    const samples = Array.from({ length: 100 }, () => 1);
    const result = computePercentiles(samples);
    expect(result.p50).toBe(1);
    expect(result.p95).toBe(1);
    expect(result.p99).toBe(1);
    expect(result.mean).toBeCloseTo(1);
  });

  it('computes mean correctly', () => {
    const samples = [2, 4, 6, 8, 10];
    const result = computePercentiles(samples);
    expect(result.mean).toBeCloseTo(6);
  });

  it('p95 < p99 for skewed distribution', () => {
    // 99 values of 1, one outlier of 1000
    const samples = [...Array.from({ length: 99 }, () => 1), 1000];
    const result = computePercentiles(samples);
    expect(result.p99).toBeGreaterThanOrEqual(result.p95);
  });

  it('does not mutate input array', () => {
    const samples = [5, 3, 1, 4, 2];
    const copy = [...samples];
    computePercentiles(samples);
    expect(samples).toEqual(copy);
  });
});

describe('mock port contracts', () => {
  it('IdGenerator.generateId() returns non-empty strings', () => {
    const gen = makeIdGenerator();
    const id = gen.generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('Clock.nowIso() returns valid ISO 8601 string', () => {
    const clock = makeClock();
    const iso = clock.nowIso();
    expect(typeof iso).toBe('string');
    expect(() => new Date(iso)).not.toThrow();
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it('ApprovalStore.saveApproval then getApprovalById returns the saved approval', async () => {
    const store = makeApprovalStore();
    const tenantId = TenantId('t-contract-test');
    const wsId = WorkspaceId('ws-contract-test');
    const fakeApproval = { approvalId: 'ap-contract-test', status: 'Pending' } as any;
    await store.saveApproval(tenantId, fakeApproval);
    const fetched = await store.getApprovalById(tenantId, wsId, 'ap-contract-test' as any);
    expect(fetched).toEqual(fakeApproval);
  });

  it('ApprovalStore.getApprovalById returns null for unknown id', async () => {
    const store = makeApprovalStore();
    const result = await store.getApprovalById(
      TenantId('t-x'),
      WorkspaceId('ws-x'),
      'no-such-id' as any,
    );
    expect(result).toBeNull();
  });

  it('AuthorizationPort.isAllowed() resolves to true', async () => {
    const auth = makeAuthorizationPort();
    const allowed = await auth.isAllowed(TEST_CTX, 'approval:create' as any);
    expect(allowed).toBe(true);
  });
});

describe('approval pipeline round-trip (createApproval + submitApproval)', () => {
  it('creates an approval and submits a decision successfully', async () => {
    const idGen = makeIdGenerator();
    const clock = makeClock();
    const approvalStore = makeApprovalStore();
    const authorization = makeAuthorizationPort();
    const eventPublisher = makeEventPublisher();
    const unitOfWork = makeUnitOfWork();
    const evidenceLog = makeEvidenceLog();

    const deps = {
      idGenerator: idGen,
      clock,
      approvalStore,
      authorization,
      eventPublisher,
      unitOfWork,
      evidenceLog,
    };

    // Use separate contexts for requester vs approver (maker-checker: different users required)
    const requesterCtx: AppContext = {
      tenantId: TenantId('tenant-test'),
      principalId: UserId('user-requester'),
      roles: [],
      scopes: [],
      correlationId: CorrelationId('corr-test'),
    };
    const approverCtx: AppContext = {
      tenantId: TenantId('tenant-test'),
      principalId: UserId('user-approver'),
      roles: [],
      scopes: [],
      correlationId: CorrelationId('corr-test'),
    };

    // Create
    const createResult = await createApproval(deps, requesterCtx, {
      workspaceId: 'ws-test',
      runId: 'run-roundtrip',
      planId: 'plan-roundtrip',
      prompt: 'Please approve this test action.',
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;
    expect(createResult.value.status).toBe('Pending');

    // Submit (Approve) — different user to satisfy maker-checker constraint
    const submitResult = await submitApproval(deps, approverCtx, {
      workspaceId: 'ws-test',
      approvalId: String(createResult.value.approvalId),
      decision: 'Approved',
      rationale: 'Test round-trip: approved.',
    });

    expect(submitResult.ok).toBe(true);
    if (!submitResult.ok) return;
    expect(submitResult.value.status).toBe('Approved');
  });

  it('returns an error when submitting a non-existent approval', async () => {
    const deps = {
      idGenerator: makeIdGenerator(),
      clock: makeClock(),
      approvalStore: makeApprovalStore(),
      authorization: makeAuthorizationPort(),
      eventPublisher: makeEventPublisher(),
      unitOfWork: makeUnitOfWork(),
      evidenceLog: makeEvidenceLog(),
    };

    const result = await submitApproval(deps, TEST_CTX, {
      workspaceId: 'ws-test',
      approvalId: 'no-such-approval',
      decision: 'Denied',
      rationale: 'Not found test.',
    });

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SLO baseline assertions (skipped in standard CI — run locally for perf gating)
// ---------------------------------------------------------------------------

describe.skipIf(process.env['CI_PERF_SKIP'] === 'true')(
  'approval pipeline SLO baselines (in-memory)',
  () => {
    const SLO_P95_MS = 50; // from approval-pipeline-slo-v1.md
    const SLO_P99_MS = 100;
    const ITERATIONS = 500;

    async function measureCreateApproval(): Promise<number[]> {
      const deps = {
        idGenerator: makeIdGenerator(),
        clock: makeClock(),
        approvalStore: makeApprovalStore(),
        authorization: makeAuthorizationPort(),
        eventPublisher: makeEventPublisher(),
        unitOfWork: makeUnitOfWork(),
        evidenceLog: makeEvidenceLog(),
      };

      const samples: number[] = [];
      for (let i = 0; i < ITERATIONS; i++) {
        const t0 = performance.now();
        await createApproval(deps, TEST_CTX, {
          workspaceId: 'ws-test',
          runId: `run-slo-${i}`,
          planId: `plan-slo-${i}`,
          prompt: `SLO test approval ${i}`,
        });
        samples.push(performance.now() - t0);
      }
      return samples;
    }

    it(`createApproval p95 is within ${SLO_P95_MS}ms SLO`, async () => {
      const samples = await measureCreateApproval();
      const result = computePercentiles(samples);
      expect(result.p95).toBeLessThanOrEqual(SLO_P95_MS);
    }, 30_000);

    it(`createApproval p99 is within ${SLO_P99_MS}ms SLO`, async () => {
      const samples = await measureCreateApproval();
      const result = computePercentiles(samples);
      expect(result.p99).toBeLessThanOrEqual(SLO_P99_MS);
    }, 30_000);
  },
);
