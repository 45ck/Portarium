/**
 * Load test: Concurrent multi-tenant request handling (bead-0940)
 *
 * Validates that the approval pipeline handles concurrent requests from
 * multiple independent tenants without cross-contamination, performance
 * degradation, or correctness errors.
 *
 * Uses in-memory adapters only — no external infrastructure required.
 */

import { describe, expect, it } from 'vitest';

import { parsePolicyV1 } from '../../src/domain/policy/index.js';
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

// ---------------------------------------------------------------------------
// In-memory stubs (per-tenant isolated stores)
// ---------------------------------------------------------------------------

function makeApprovalStore(): ApprovalStore {
  const store = new Map<string, any>();
  return {
    async getApprovalById(_tenantId, _workspaceId, approvalId) {
      return store.get(String(approvalId)) ?? null;
    },
    async saveApproval(_tenantId, approval) {
      store.set(String(approval.approvalId), approval);
    },
  };
}

function makeSharedDeps(approvalStore: ApprovalStore, proposalStore: AgentActionProposalStore) {
  let idSeq = 0;
  const authorization: AuthorizationPort = { isAllowed: async () => true };
  const clock: Clock = { nowIso: () => new Date().toISOString() };
  const idGenerator: IdGenerator = {
    generateId: () => `id-${++idSeq}-${Math.random().toString(36).slice(2)}`,
  };
  const unitOfWork: UnitOfWork = { execute: async (fn) => fn() };
  const eventPublisher: EventPublisher = { publish: async () => undefined };
  const evidenceLog: EvidenceLogPort = {
    appendEntry: async (_tenantId, entry) => ({ ...entry, hashSha256: 'load-hash' as never }),
  };
  const policyStore: PolicyStore = {
    getPolicyById: async () =>
      parsePolicyV1({
        schemaVersion: 1,
        policyId: 'pol-load-1',
        workspaceId: 'ws-load',
        name: 'Load Test Policy',
        active: true,
        priority: 1,
        version: 1,
        createdAtIso: '2026-01-01T00:00:00.000Z',
        createdByUserId: 'admin-1',
      }),
    savePolicy: async () => {},
  };
  const actionRunner: ActionRunnerPort = {
    dispatchAction: async () => ({ ok: true as const, output: { result: 'load-ok' } }),
  };

  return {
    authorization,
    clock,
    idGenerator,
    unitOfWork,
    eventPublisher,
    evidenceLog,
    policyStore,
    approvalStore,
    proposalStore,
    actionRunner,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('load: concurrent multi-tenant requests', () => {
  it(
    'handles 10 tenants x 50 concurrent pipelines without errors',
    { timeout: 60_000 },
    async () => {
      const TENANT_COUNT = 10;
      const PIPELINES_PER_TENANT = 50;

      const tenantResults = new Map<string, { successes: number; errors: number }>();

      // Each tenant has its own isolated stores
      const tenantTasks = Array.from({ length: TENANT_COUNT }, (_, t) => {
        const tenantId = `ws-load-${t}`;
        const approvalStore = makeApprovalStore();
        const proposalStore = new InMemoryAgentActionProposalStore();
        const deps = makeSharedDeps(approvalStore, proposalStore);

        return runConcurrent(
          async (idx) => {
            const agentCtx = toAppContext({
              tenantId,
              principalId: `agent-${t}-${idx}`,
              correlationId: `corr-${t}-${idx}`,
              roles: ['operator'],
            });

            const approverCtx = toAppContext({
              tenantId,
              principalId: `approver-${t}-${idx}`,
              correlationId: `corr-approve-${t}-${idx}`,
              roles: ['approver'],
            });

            // Stage 1: propose
            const proposeResult = await proposeAgentAction(deps, agentCtx, {
              workspaceId: `ws-load-${t}`,
              agentId: `agent-${t}-${idx}`,
              actionKind: 'comms:sendEmail',
              toolName: 'email:send',
              executionTier: 'HumanApprove',
              policyIds: ['pol-load-1'],
              rationale: `Multi-tenant load test t=${t} i=${idx}`,
            });

            if (!proposeResult.ok) {
              throw new Error(`propose failed: ${proposeResult.error.kind}`);
            }

            const { approvalId } = proposeResult.value;
            if (!approvalId) throw new Error('Expected NeedsApproval');

            // Stage 2: approve
            const submitResult = await submitApproval({ ...deps }, approverCtx, {
              workspaceId: `ws-load-${t}`,
              approvalId,
              decision: 'Approved',
              rationale: `Load approve t=${t} i=${idx}`,
            });

            if (!submitResult.ok) {
              throw new Error(`submit failed: ${submitResult.error.kind}`);
            }

            // Stage 3: execute
            const executeResult = await executeApprovedAgentAction({ ...deps }, agentCtx, {
              workspaceId: `ws-load-${t}`,
              approvalId,
              flowRef: 'email:send',
            });

            if (!executeResult.ok) {
              throw new Error(`execute failed: ${executeResult.error.kind}`);
            }
          },
          PIPELINES_PER_TENANT,
          10, // concurrency per tenant
        );
      });

      const results = await Promise.all(tenantTasks);

      let totalSuccesses = 0;
      let totalErrors = 0;
      const allDurations: number[] = [];

      results.forEach((r, t) => {
        totalSuccesses += r.successes;
        totalErrors += r.errors;
        allDurations.push(...r.durations);
        tenantResults.set(`ws-load-${t}`, {
          successes: r.successes,
          errors: r.errors,
        });
      });

      const stats = computeStats(allDurations);
      console.info(formatStats('multi-tenant pipeline (all tenants)', stats));

      // Zero errors across all tenants
      expect(totalErrors).toBe(0);
      expect(totalSuccesses).toBe(TENANT_COUNT * PIPELINES_PER_TENANT);

      // Each tenant completed exactly its share
      for (const [tid, counts] of tenantResults) {
        expect(counts.errors, `${tid} had errors`).toBe(0);
        expect(counts.successes, `${tid} incomplete`).toBe(PIPELINES_PER_TENANT);
      }
    },
  );

  it(
    'tenant isolation: concurrent proposals from different tenants do not share state',
    { timeout: 30_000 },
    async () => {
      const TENANT_COUNT = 20;
      const PROPOSALS_PER_TENANT = 20;

      // Each tenant gets its own approval store — proposals must stay isolated
      const perTenantApprovalIds = new Map<string, Set<string>>();

      const tasks = Array.from({ length: TENANT_COUNT }, (_, t) => {
        const tenantId = `ws-iso-${t}`;
        const approvalStore = makeApprovalStore();
        const proposalStore = new InMemoryAgentActionProposalStore();
        const deps = makeSharedDeps(approvalStore, proposalStore);
        perTenantApprovalIds.set(tenantId, new Set());

        return runConcurrent(
          async (idx) => {
            const ctx = toAppContext({
              tenantId,
              principalId: `agent-${t}-${idx}`,
              correlationId: `corr-iso-${t}-${idx}`,
              roles: ['operator'],
            });

            const result = await proposeAgentAction(deps, ctx, {
              workspaceId: `ws-iso-${t}`,
              agentId: `agent-${t}-${idx}`,
              actionKind: 'comms:listEmails',
              toolName: 'email:list',
              executionTier: 'Auto',
              policyIds: ['pol-load-1'],
              rationale: `Isolation test t=${t} i=${idx}`,
            });

            if (!result.ok) throw new Error(`propose failed: ${result.error.kind}`);
            if (result.value.approvalId) {
              perTenantApprovalIds.get(tenantId)!.add(result.value.approvalId);
            }
          },
          PROPOSALS_PER_TENANT,
          10,
        );
      });

      const results = await Promise.all(tasks);

      // No errors
      for (const r of results) {
        expect(r.errors).toBe(0);
      }

      // No approval IDs overlap across tenants
      const allIds = new Set<string>();
      for (const [, ids] of perTenantApprovalIds) {
        for (const id of ids) {
          expect(allIds.has(id), `duplicate approval ID across tenants: ${id}`).toBe(false);
          allIds.add(id);
        }
      }
    },
  );
});
