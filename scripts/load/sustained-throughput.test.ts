/**
 * Load test: Sustained throughput benchmarks (bead-0940)
 *
 * Measures requests-per-second (RPS) for core pipeline operations under
 * sustained load by running a large number of concurrent requests and
 * computing throughput from wall-clock time.
 *
 * Modes:
 *   - Smoke (LOAD_MODE=smoke, default): 500 requests, quick CI feedback
 *   - Full  (LOAD_MODE=full): 5000 requests, production-grade measurement
 *
 * All tests use in-memory adapters — no external infrastructure.
 */

import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from '../../src/domain/policy/index.js';
import { parseApprovalV1 } from '../../src/domain/approvals/index.js';
import { TenantId } from '../../src/domain/primitives/index.js';
import { toAppContext } from '../../src/application/common/context.js';
import type {
  ActionRunnerPort,
  AgentActionProposalStore,
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../../src/application/ports/index.js';
import { InMemoryAgentActionProposalStore } from '../../src/infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { proposeAgentAction } from '../../src/application/commands/propose-agent-action.js';
import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { executeApprovedAgentAction } from '../../src/application/commands/execute-approved-agent-action.js';
import { computeStats, formatStats, runConcurrent } from './harness.js';
import type { ApprovalV1 } from '../../src/domain/approvals/index.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODE = process.env['LOAD_MODE'] === 'full' ? 'full' : 'smoke';
const TOTAL_REQUESTS = MODE === 'full' ? 5000 : 500;
const CONCURRENCY = MODE === 'full' ? 50 : 20;

// Minimum RPS thresholds (in-memory, no I/O — should be high)
const MIN_PROPOSE_RPS = 500;
const MIN_SUBMIT_RPS = 500;
const MIN_EXECUTE_RPS = 500;
const MIN_FULL_PIPELINE_RPS = 200;

// ---------------------------------------------------------------------------
// In-memory stubs
// ---------------------------------------------------------------------------

function makeApprovalStore(): ApprovalStore {
  const store = new Map<string, ApprovalV1>();
  return {
    async getApprovalById(_tenantId, _workspaceId, approvalId) {
      return store.get(String(approvalId)) ?? null;
    },
    async saveApproval(_tenantId, approval) {
      store.set(String(approval.approvalId), approval);
    },
  };
}

function makeDeps(approvalStore: ApprovalStore, proposalStore: AgentActionProposalStore) {
  let idSeq = 0;
  return {
    authorization: { isAllowed: async () => true } as AuthorizationPort,
    clock: { nowIso: () => new Date().toISOString() } as Clock,
    idGenerator: {
      generateId: () => `perf-${++idSeq}-${Math.random().toString(36).slice(2)}`,
    } as IdGenerator,
    unitOfWork: { execute: async (fn: () => any) => fn() } as UnitOfWork,
    eventPublisher: { publish: async () => undefined } as EventPublisher,
    evidenceLog: {
      appendEntry: async (_t: any, entry: any) => ({ ...entry, hashSha256: 'perf-hash' }),
    } as unknown as EvidenceLogPort,
    policyStore: {
      getPolicyById: async () =>
        parsePolicyV1({
          schemaVersion: 1,
          policyId: 'pol-perf-1',
          workspaceId: 'ws-perf',
          name: 'Throughput Policy',
          active: true,
          priority: 1,
          version: 1,
          createdAtIso: '2026-01-01T00:00:00.000Z',
          createdByUserId: 'admin-1',
        }),
      savePolicy: async () => {},
    } as PolicyStore,
    approvalStore,
    proposalStore,
    actionRunner: {
      dispatchAction: async () => ({ ok: true as const, output: { result: 'perf-ok' } }),
    } as ActionRunnerPort,
  };
}

// Pre-create contexts to avoid per-iteration allocation
const agentCtxPool = Array.from({ length: CONCURRENCY }, (_, i) =>
  toAppContext({
    tenantId: 'ws-perf',
    principalId: `agent-perf-${i}`,
    correlationId: `corr-perf-${i}`,
    roles: ['operator'],
  }),
);

const approverCtxPool = Array.from({ length: CONCURRENCY }, (_, i) =>
  toAppContext({
    tenantId: 'ws-perf',
    principalId: `approver-perf-${i}`,
    correlationId: `corr-approve-perf-${i}`,
    roles: ['approver'],
  }),
);

function agentCtx(idx: number) {
  return agentCtxPool[idx % agentCtxPool.length]!;
}

function approverCtx(idx: number) {
  return approverCtxPool[idx % approverCtxPool.length]!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe(`sustained throughput benchmarks (${MODE} mode, n=${TOTAL_REQUESTS})`, () => {
  it(`proposeAgentAction sustained RPS >= ${MIN_PROPOSE_RPS}`, { timeout: 60_000 }, async () => {
    const approvalStore = makeApprovalStore();
    const proposalStore = new InMemoryAgentActionProposalStore();
    const deps = makeDeps(approvalStore, proposalStore);

    const result = await runConcurrent(
      async (idx) => {
        const r = await proposeAgentAction(deps, agentCtx(idx), {
          workspaceId: 'ws-perf',
          agentId: `agent-perf-${idx}`,
          actionKind: 'comms:listEmails',
          toolName: 'email:list',
          executionTier: 'Auto',
          policyIds: ['pol-perf-1'],
          rationale: `Throughput test ${idx}`,
        });
        if (!r.ok) throw new Error(`propose failed: ${r.error.kind}`);
      },
      TOTAL_REQUESTS,
      CONCURRENCY,
    );

    const stats = computeStats(result.durations);
    const rps = (result.successes / result.elapsedMs) * 1000;
    console.info(formatStats('proposeAgentAction sustained', stats));
    console.info(
      `[LOAD] proposeAgentAction: ${rps.toFixed(1)} RPS ` +
        `(${result.successes} ok, ${result.errors} err, ${(result.elapsedMs / 1000).toFixed(1)}s)`,
    );

    expect(result.errors).toBe(0);
    expect(rps).toBeGreaterThanOrEqual(MIN_PROPOSE_RPS);
  });

  it(`submitApproval sustained RPS >= ${MIN_SUBMIT_RPS}`, { timeout: 60_000 }, async () => {
    const approvalStore = makeApprovalStore();
    const proposalStore = new InMemoryAgentActionProposalStore();
    const deps = makeDeps(approvalStore, proposalStore);

    // Pre-seed approvals
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      await approvalStore.saveApproval(
        TenantId('ws-perf'),
        parseApprovalV1({
          schemaVersion: 1,
          approvalId: `submit-perf-${i}`,
          workspaceId: 'ws-perf',
          runId: `run-perf-${i}`,
          planId: `plan-perf-${i}`,
          prompt: `Throughput approval ${i}`,
          requestedAtIso: '2026-03-10T00:00:00.000Z',
          requestedByUserId: 'agent-perf-0',
          status: 'Pending',
        }),
      );
    }

    const result = await runConcurrent(
      async (idx) => {
        const r = await submitApproval(deps, approverCtx(idx), {
          workspaceId: 'ws-perf',
          approvalId: `submit-perf-${idx}`,
          decision: 'Approved',
          rationale: `Throughput approve ${idx}`,
        });
        if (!r.ok) throw new Error(`submit failed: ${r.error.kind}`);
      },
      TOTAL_REQUESTS,
      CONCURRENCY,
    );

    const stats = computeStats(result.durations);
    const rps = (result.successes / result.elapsedMs) * 1000;
    console.info(formatStats('submitApproval sustained', stats));
    console.info(
      `[LOAD] submitApproval: ${rps.toFixed(1)} RPS ` +
        `(${result.successes} ok, ${result.errors} err, ${(result.elapsedMs / 1000).toFixed(1)}s)`,
    );

    expect(result.errors).toBe(0);
    expect(rps).toBeGreaterThanOrEqual(MIN_SUBMIT_RPS);
  });

  it(
    `executeApprovedAgentAction sustained RPS >= ${MIN_EXECUTE_RPS}`,
    { timeout: 60_000 },
    async () => {
      const approvalStore = makeApprovalStore();
      const proposalStore = new InMemoryAgentActionProposalStore();
      const deps = makeDeps(approvalStore, proposalStore);

      // Pre-seed Approved approvals
      for (let i = 0; i < TOTAL_REQUESTS; i++) {
        await approvalStore.saveApproval(
          TenantId('ws-perf'),
          parseApprovalV1({
            schemaVersion: 1,
            approvalId: `exec-perf-${i}`,
            workspaceId: 'ws-perf',
            runId: `run-exec-${i}`,
            planId: `plan-exec-${i}`,
            prompt: `Execute throughput ${i}`,
            requestedAtIso: '2026-03-10T00:00:00.000Z',
            requestedByUserId: 'agent-perf-0',
            status: 'Approved',
            decidedAtIso: '2026-03-10T00:01:00.000Z',
            decidedByUserId: 'approver-perf-0',
            rationale: 'Pre-approved for throughput.',
          }),
        );
      }

      const result = await runConcurrent(
        async (idx) => {
          const r = await executeApprovedAgentAction(deps, agentCtx(idx), {
            workspaceId: 'ws-perf',
            approvalId: `exec-perf-${idx}`,
            flowRef: `flow-perf-${idx}`,
            payload: { index: idx },
          });
          if (!r.ok) throw new Error(`execute failed: ${r.error.kind}`);
        },
        TOTAL_REQUESTS,
        CONCURRENCY,
      );

      const stats = computeStats(result.durations);
      const rps = (result.successes / result.elapsedMs) * 1000;
      console.info(formatStats('executeApprovedAgentAction sustained', stats));
      console.info(
        `[LOAD] executeApprovedAgentAction: ${rps.toFixed(1)} RPS ` +
          `(${result.successes} ok, ${result.errors} err, ${(result.elapsedMs / 1000).toFixed(1)}s)`,
      );

      expect(result.errors).toBe(0);
      expect(rps).toBeGreaterThanOrEqual(MIN_EXECUTE_RPS);
    },
  );

  it(
    `full pipeline (propose->submit->execute) sustained RPS >= ${MIN_FULL_PIPELINE_RPS}`,
    { timeout: 120_000 },
    async () => {
      const approvalStore = makeApprovalStore();
      const proposalStore = new InMemoryAgentActionProposalStore();
      const deps = makeDeps(approvalStore, proposalStore);

      const result = await runConcurrent(
        async (idx) => {
          // Stage 1: propose
          const proposeResult = await proposeAgentAction(deps, agentCtx(idx), {
            workspaceId: 'ws-perf',
            agentId: `agent-perf-${idx}`,
            actionKind: 'comms:sendEmail',
            toolName: 'email:send',
            executionTier: 'HumanApprove',
            policyIds: ['pol-perf-1'],
            rationale: `Full pipeline throughput ${idx}`,
          });
          if (!proposeResult.ok) throw new Error(`propose failed: ${proposeResult.error.kind}`);

          const { approvalId } = proposeResult.value;
          if (!approvalId) throw new Error('Expected NeedsApproval');

          // Stage 2: submit
          const submitResult = await submitApproval(deps, approverCtx(idx), {
            workspaceId: 'ws-perf',
            approvalId,
            decision: 'Approved',
            rationale: `Pipeline approve ${idx}`,
          });
          if (!submitResult.ok) throw new Error(`submit failed: ${submitResult.error.kind}`);

          // Stage 3: execute
          const executeResult = await executeApprovedAgentAction(deps, agentCtx(idx), {
            workspaceId: 'ws-perf',
            approvalId,
            flowRef: 'email:send',
          });
          if (!executeResult.ok) throw new Error(`execute failed: ${executeResult.error.kind}`);
        },
        TOTAL_REQUESTS,
        CONCURRENCY,
      );

      const stats = computeStats(result.durations);
      const rps = (result.successes / result.elapsedMs) * 1000;
      console.info(formatStats('full pipeline sustained', stats));
      console.info(
        `[LOAD] full pipeline: ${rps.toFixed(1)} RPS ` +
          `(${result.successes} ok, ${result.errors} err, ${(result.elapsedMs / 1000).toFixed(1)}s)`,
      );

      expect(result.errors).toBe(0);
      expect(rps).toBeGreaterThanOrEqual(MIN_FULL_PIPELINE_RPS);
    },
  );
});
