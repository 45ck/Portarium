/**
 * bead-0911: Approval pipeline load characterisation and SLOs
 *
 * Exercises proposeAgentAction → submitApproval → executeApprovedAgentAction
 * under concurrent load using in-memory adapters only (no DB / network).
 *
 * SLO thresholds are defined in:
 *   .specify/specs/approval-pipeline-slo-v1.md
 *
 * To skip on unreliable CI runners set env var: CI_PERF_SKIP=true
 */

import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from '../../domain/policy/index.js';
import { parseApprovalV1, type ApprovalV1 } from '../../domain/approvals/index.js';
import {
  TenantId,
  type ApprovalId as ApprovalIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../domain/primitives/index.js';
import { toAppContext } from '../common/context.js';
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
} from '../ports/index.js';
import { InMemoryAgentActionProposalStore } from '../../infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { proposeAgentAction } from './propose-agent-action.js';
import { submitApproval } from './submit-approval.js';
import { executeApprovedAgentAction } from './execute-approved-agent-action.js';

// ---------------------------------------------------------------------------
// SLO thresholds (mirror of .specify/specs/approval-pipeline-slo-v1.md)
// ---------------------------------------------------------------------------

const SLO = {
  /** p95 latency per individual stage when called concurrently (ms). */
  perStageP95Ms: 50,
  /** p95 latency for the full 3-stage pipeline (ms). */
  fullPipelineP95Ms: 150,
} as const;

const CONCURRENCY = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

function measurePercentiles(durations: number[]): { p50: number; p95: number; p99: number } {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

// ---------------------------------------------------------------------------
// In-memory stubs
// ---------------------------------------------------------------------------

class InMemoryApprovalStore implements ApprovalStore {
  readonly #byId = new Map<string, ApprovalV1>();

  async getApprovalById(
    _tenantId: TenantId,
    _workspaceId: WorkspaceIdType,
    approvalId: ApprovalIdType,
  ): Promise<ApprovalV1 | null> {
    return this.#byId.get(String(approvalId)) ?? null;
  }

  async saveApproval(_tenantId: TenantId, approval: ApprovalV1): Promise<void> {
    this.#byId.set(String(approval.approvalId), approval);
  }
}

function makePolicy() {
  return parsePolicyV1({
    schemaVersion: 1,
    policyId: 'pol-perf-1',
    workspaceId: 'ws-perf-1',
    name: 'Perf Test Policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-01-01T00:00:00.000Z',
    createdByUserId: 'admin-1',
  });
}

function makeDeps(
  approvalStore: ApprovalStore,
  proposalStore: AgentActionProposalStore,
  idSeqRef: { n: number },
) {
  const authorization: AuthorizationPort = { isAllowed: async () => true };
  const clock: Clock = { nowIso: () => '2026-03-10T00:00:00.000Z' };
  const idGenerator: IdGenerator = {
    generateId: () => `id-${++idSeqRef.n}-${Math.random().toString(36).slice(2)}`,
  };
  const unitOfWork: UnitOfWork = { execute: async (fn) => fn() };
  const policyStore: PolicyStore = { getPolicyById: async () => makePolicy() };
  const eventPublisher: EventPublisher = { publish: async () => undefined };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: async (_tenantId, entry) => ({
      ...entry,
      hashSha256: 'perf-hash' as never,
    }),
  };

  return {
    authorization,
    clock,
    idGenerator,
    unitOfWork,
    policyStore,
    approvalStore,
    proposalStore,
    eventPublisher,
    evidenceLog,
  };
}

function makeSubmitDeps(approvalStore: ApprovalStore) {
  const authorization: AuthorizationPort = { isAllowed: async () => true };
  const clock: Clock = { nowIso: () => '2026-03-10T00:01:00.000Z' };
  const idGenerator: IdGenerator = {
    generateId: () => `evt-${Math.random().toString(36).slice(2)}`,
  };
  const unitOfWork: UnitOfWork = { execute: async (fn) => fn() };
  const eventPublisher: EventPublisher = { publish: async () => undefined };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: async (_tenantId, entry) => ({
      ...entry,
      hashSha256: 'submit-hash' as never,
    }),
  };

  return {
    authorization,
    clock,
    idGenerator,
    approvalStore,
    unitOfWork,
    eventPublisher,
    evidenceLog,
  };
}

function makeExecuteDeps(approvalStore: ApprovalStore) {
  const authorization: AuthorizationPort = { isAllowed: async () => true };
  const clock: Clock = { nowIso: () => '2026-03-10T00:02:00.000Z' };
  const idGenerator: IdGenerator = {
    generateId: () => `exec-${Math.random().toString(36).slice(2)}`,
  };
  const unitOfWork: UnitOfWork = { execute: async (fn) => fn() };
  const eventPublisher: EventPublisher = { publish: async () => undefined };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: async (_tenantId, entry) => ({
      ...entry,
      hashSha256: 'exec-hash' as never,
    }),
  };
  const actionRunner: ActionRunnerPort = {
    dispatchAction: async () => ({ ok: true as const, output: { result: 'perf-ok' } }),
  };

  return {
    authorization,
    clock,
    idGenerator,
    approvalStore,
    unitOfWork,
    eventPublisher,
    evidenceLog,
    actionRunner,
  };
}

function makeAgentCtx(idx: number) {
  return toAppContext({
    tenantId: 'ws-perf-1',
    principalId: `agent-perf-${idx}`,
    correlationId: `corr-perf-${idx}`,
    roles: ['operator'],
  });
}

/** Approval submitter must be a different principal from the requester (maker-checker). */
function makeApproverCtx(idx: number) {
  return toAppContext({
    tenantId: 'ws-perf-1',
    principalId: `approver-perf-${idx}`,
    correlationId: `corr-approve-${idx}`,
    roles: ['approver'],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(process.env['CI_PERF_SKIP'] === 'true')(
  'approval pipeline SLO — load characterisation',
  () => {
    it(
      `proposeAgentAction: p95 ≤ ${SLO.perStageP95Ms} ms under ${CONCURRENCY} concurrent calls`,
      { timeout: 30_000 },
      async () => {
        const approvalStore = new InMemoryApprovalStore();
        const proposalStore = new InMemoryAgentActionProposalStore();
        const idSeqRef = { n: 0 };

        const tasks = Array.from({ length: CONCURRENCY }, (_, i) => async () => {
          const start = performance.now();
          const result = await proposeAgentAction(
            makeDeps(approvalStore, proposalStore, idSeqRef),
            makeAgentCtx(i),
            {
              workspaceId: 'ws-perf-1',
              agentId: `agent-perf-${i}`,
              actionKind: 'comms:listEmails',
              toolName: 'email:list',
              executionTier: 'Auto',
              policyIds: ['pol-perf-1'],
              rationale: `Perf test proposal ${i}`,
            },
          );
          const duration = performance.now() - start;
          if (!result.ok) throw new Error(`proposeAgentAction failed: ${result.error.kind}`);
          return duration;
        });

        const durations = await Promise.all(tasks.map((t) => t()));
        const { p50, p95, p99 } = measurePercentiles(durations);

        console.info(
          `[SLO] proposeAgentAction n=${CONCURRENCY}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`,
        );

        expect(p95, `proposeAgentAction p95 must be ≤ ${SLO.perStageP95Ms} ms`).toBeLessThanOrEqual(
          SLO.perStageP95Ms,
        );
      },
    );

    it(
      `submitApproval: p95 ≤ ${SLO.perStageP95Ms} ms under ${CONCURRENCY} concurrent calls`,
      { timeout: 30_000 },
      async () => {
        // Pre-seed approvals so each submitApproval call finds a Pending record.
        const approvalStore = new InMemoryApprovalStore();
        const approvalIds = Array.from({ length: CONCURRENCY }, (_, i) => `approval-perf-${i}`);

        for (const id of approvalIds) {
          await approvalStore.saveApproval(
            TenantId('ws-perf-1'),
            parseApprovalV1({
              schemaVersion: 1,
              approvalId: id,
              workspaceId: 'ws-perf-1',
              runId: `run-perf-${id}`,
              planId: `plan-perf-${id}`,
              prompt: `Approve perf action ${id}.`,
              requestedAtIso: '2026-03-10T00:00:00.000Z',
              requestedByUserId: 'agent-perf-0',
              status: 'Pending',
            }),
          );
        }

        const tasks = approvalIds.map((approvalId, i) => async () => {
          const start = performance.now();
          const result = await submitApproval(makeSubmitDeps(approvalStore), makeApproverCtx(i), {
            workspaceId: 'ws-perf-1',
            approvalId,
            decision: 'Approved',
            rationale: `Perf approve ${i}`,
          });
          const duration = performance.now() - start;
          if (!result.ok) throw new Error(`submitApproval failed: ${result.error.kind}`);
          return duration;
        });

        const durations = await Promise.all(tasks.map((t) => t()));
        const { p50, p95, p99 } = measurePercentiles(durations);

        console.info(
          `[SLO] submitApproval n=${CONCURRENCY}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`,
        );

        expect(p95, `submitApproval p95 must be ≤ ${SLO.perStageP95Ms} ms`).toBeLessThanOrEqual(
          SLO.perStageP95Ms,
        );
      },
    );

    it(
      `executeApprovedAgentAction: p95 ≤ ${SLO.perStageP95Ms} ms under ${CONCURRENCY} concurrent calls`,
      { timeout: 30_000 },
      async () => {
        // Pre-seed Approved approvals so executeApprovedAgentAction finds them.
        const approvalStore = new InMemoryApprovalStore();
        const approvalIds = Array.from(
          { length: CONCURRENCY },
          (_, i) => `exec-approval-perf-${i}`,
        );

        for (const id of approvalIds) {
          await approvalStore.saveApproval(
            TenantId('ws-perf-1'),
            parseApprovalV1({
              schemaVersion: 1,
              approvalId: id,
              workspaceId: 'ws-perf-1',
              runId: `run-exec-perf-${id}`,
              planId: `plan-exec-perf-${id}`,
              prompt: `Execute perf action ${id}.`,
              requestedAtIso: '2026-03-10T00:00:00.000Z',
              requestedByUserId: 'agent-perf-0',
              status: 'Approved',
              decidedAtIso: '2026-03-10T00:01:00.000Z',
              decidedByUserId: 'approver-perf-0',
              rationale: 'Approved for perf test.',
            }),
          );
        }

        const tasks = approvalIds.map((approvalId, i) => async () => {
          const start = performance.now();
          const result = await executeApprovedAgentAction(
            makeExecuteDeps(approvalStore),
            makeAgentCtx(i),
            {
              workspaceId: 'ws-perf-1',
              approvalId,
              flowRef: `flow-perf-${i}`,
              payload: { index: i },
            },
          );
          const duration = performance.now() - start;
          if (!result.ok)
            throw new Error(`executeApprovedAgentAction failed: ${result.error.kind}`);
          return duration;
        });

        const durations = await Promise.all(tasks.map((t) => t()));
        const { p50, p95, p99 } = measurePercentiles(durations);

        console.info(
          `[SLO] executeApprovedAgentAction n=${CONCURRENCY}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`,
        );

        expect(
          p95,
          `executeApprovedAgentAction p95 must be ≤ ${SLO.perStageP95Ms} ms`,
        ).toBeLessThanOrEqual(SLO.perStageP95Ms);
      },
    );

    it(
      `full pipeline (propose→submit→execute): p95 ≤ ${SLO.fullPipelineP95Ms} ms under ${CONCURRENCY} concurrent pipelines`,
      { timeout: 60_000 },
      async () => {
        const approvalStore = new InMemoryApprovalStore();
        const proposalStore = new InMemoryAgentActionProposalStore();
        const idSeqRef = { n: 0 };

        const tasks = Array.from({ length: CONCURRENCY }, (_, i) => async () => {
          const start = performance.now();

          // Stage 1: propose
          const proposeResult = await proposeAgentAction(
            makeDeps(approvalStore, proposalStore, idSeqRef),
            makeAgentCtx(i),
            {
              workspaceId: 'ws-perf-1',
              agentId: `agent-pipeline-perf-${i}`,
              actionKind: 'comms:sendEmail',
              toolName: 'email:send',
              executionTier: 'HumanApprove',
              policyIds: ['pol-perf-1'],
              rationale: `Full pipeline perf test ${i}`,
            },
          );
          if (!proposeResult.ok)
            throw new Error(`proposeAgentAction failed: ${proposeResult.error.kind}`);

          const { approvalId } = proposeResult.value;
          if (!approvalId) throw new Error('Expected NeedsApproval with approvalId');

          // Stage 2: submit approval (different principal — maker-checker requires distinct approver)
          const submitResult = await submitApproval(
            makeSubmitDeps(approvalStore),
            makeApproverCtx(i),
            {
              workspaceId: 'ws-perf-1',
              approvalId,
              decision: 'Approved',
              rationale: `Full pipeline approve ${i}`,
            },
          );
          if (!submitResult.ok)
            throw new Error(`submitApproval failed: ${submitResult.error.kind}`);

          // Stage 3: execute
          const executeResult = await executeApprovedAgentAction(
            makeExecuteDeps(approvalStore),
            makeAgentCtx(i),
            {
              workspaceId: 'ws-perf-1',
              approvalId,
              flowRef: `flow-pipeline-perf-${i}`,
              payload: { index: i },
            },
          );
          if (!executeResult.ok)
            throw new Error(`executeApprovedAgentAction failed: ${executeResult.error.kind}`);

          return performance.now() - start;
        });

        const durations = await Promise.all(tasks.map((t) => t()));
        const { p50, p95, p99 } = measurePercentiles(durations);

        console.info(
          `[SLO] full pipeline n=${CONCURRENCY}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`,
        );

        expect(p95, `full pipeline p95 must be ≤ ${SLO.fullPipelineP95Ms} ms`).toBeLessThanOrEqual(
          SLO.fullPipelineP95Ms,
        );
      },
    );
  },
);
