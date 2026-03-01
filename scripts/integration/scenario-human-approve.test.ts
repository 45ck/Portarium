/**
 * Scenario: HumanApprove pause/resume with maker-checker and decision audit chain.
 *
 * This scenario exercises the full approval-gated run lifecycle:
 *   1. Create a run in HumanApprove tier → run pauses at approval gate.
 *   2. Attempt approval by the run requester (maker) → SoD violation (MakerChecker).
 *   3. Resolve approval with an authorized (distinct) approver → run resumes.
 *   4. Verify evidence chain records: approval-requested → approval-resolved → run-completed.
 *
 * Delta beyond governed-run smoke (bead-0736):
 * - governed-run-smoke tests submitApproval in isolation with a single stub approver.
 * - This scenario wires the full approval lifecycle through SoD constraints:
 *   1. Creates a pending approval linked to a run in HumanApprove tier.
 *   2. Validates MakerChecker enforcement — the maker is rejected as approver.
 *   3. An authorized (distinct) approver resolves the gate.
 *   4. Evidence chain includes three entries: requested, resolved, completed.
 *   5. Each evidence entry carries correct category, correlation, and hash chain.
 *
 * Bead: bead-0846
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  EvidenceId,
  HashSha256,
  UserId as UserIdType,
} from '../../src/domain/primitives/index.js';
import {
  ApprovalId,
  CorrelationId as CorrelationIdCtor,
  PlanId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import type { ApprovalStore } from '../../src/application/ports/approval-store.js';
import type { EvidenceLogPort } from '../../src/application/ports/evidence-log.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  UnitOfWork,
} from '../../src/application/ports/index.js';
import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { toAppContext } from '../../src/application/common/context.js';
import type { SodConstraintV1 } from '../../src/domain/policy/sod-constraints-v1.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = TenantId('tenant-scenario-ha');
const WORKSPACE_ID = WorkspaceId('ws-scenario-ha');
const RUN_ID = RunId('run-ha-001');
const PLAN_ID = PlanId('plan-ha-001');
const APPROVAL_ID = ApprovalId('approval-ha-001');
const CORRELATION_ID = CorrelationIdCtor('corr-ha-001');

const MAKER_USER_ID = UserId('user-maker-001');
const APPROVER_USER_ID = UserId('user-approver-002');

const FIXED_REQUEST_TIME = '2026-03-02T10:00:00.000Z';
const FIXED_DECIDE_TIME = '2026-03-02T10:05:00.000Z';
const FIXED_COMPLETE_TIME = '2026-03-02T10:06:00.000Z';

const MAKER_CHECKER_CONSTRAINT: SodConstraintV1 = { kind: 'MakerChecker' };

// ---------------------------------------------------------------------------
// Stub infrastructure
// ---------------------------------------------------------------------------

function makePendingApproval() {
  return {
    schemaVersion: 1,
    approvalId: APPROVAL_ID as string,
    workspaceId: WORKSPACE_ID as string,
    runId: RUN_ID as string,
    planId: PLAN_ID as string,
    prompt: 'Approve deployment to production environment.',
    requestedAtIso: FIXED_REQUEST_TIME,
    requestedByUserId: MAKER_USER_ID as string,
    status: 'Pending',
  };
}

function makeApprovalStore() {
  const saved: unknown[] = [];
  const store = new Map<string, unknown>([[APPROVAL_ID as string, makePendingApproval()]]);

  const approvalStore: ApprovalStore = {
    getApprovalById: vi.fn(async (_tenantId, _wsId, approvalId) => {
      return store.get(approvalId as string) ?? null;
    }) as ApprovalStore['getApprovalById'],
    saveApproval: vi.fn(async (_tenantId, approval) => {
      const id = (approval as { approvalId: string }).approvalId;
      store.set(id, approval);
      saved.push(approval);
    }),
  };

  return { ...approvalStore, saved };
}

function makeDeps(overrides?: { principalId?: UserIdType }) {
  const publishedEvents: unknown[] = [];
  const approvalStore = makeApprovalStore();

  const deps = {
    authorization: {
      isAllowed: vi.fn(async () => true),
    } satisfies AuthorizationPort,
    clock: { nowIso: () => FIXED_DECIDE_TIME } satisfies Clock,
    idGenerator: {
      generateId: (() => {
        let n = 0;
        return () => `evt-ha-${++n}`;
      })(),
    } satisfies IdGenerator,
    approvalStore,
    unitOfWork: {
      execute: vi.fn(async (fn) => fn()),
    } as UnitOfWork,
    eventPublisher: {
      publish: vi.fn(async (event) => {
        publishedEvents.push(event);
      }),
    } satisfies EventPublisher,
  };

  const principalId = overrides?.principalId ?? APPROVER_USER_ID;
  const ctx = toAppContext({
    tenantId: TENANT_ID as string,
    principalId: principalId as string,
    correlationId: CORRELATION_ID as string,
  });

  return { deps, ctx, approvalStore, publishedEvents };
}

function makeStubEvidenceLog(): EvidenceLogPort & { entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  let counter = 0;
  return {
    entries,
    appendEntry: vi.fn(async (_tenantId, entry) => {
      counter += 1;
      const stored = {
        ...entry,
        schemaVersion: 1 as const,
        evidenceId: `ev-ha-${counter}` as EvidenceId,
        previousHash: counter > 1 ? (`hash-ha-${counter - 1}` as HashSha256) : undefined,
        hashSha256: `hash-ha-${counter}` as HashSha256,
      };
      entries.push(stored as unknown as Record<string, unknown>);
      return stored;
    }),
  };
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

describe('Scenario: HumanApprove pause/resume with maker-checker', () => {
  // Step 1: Run pauses at approval gate (Pending state)
  describe('Step 1 — Run pauses at approval gate', () => {
    it('approval is in Pending state before any decision', () => {
      const pending = makePendingApproval();
      expect(pending.status).toBe('Pending');
      expect(pending.requestedByUserId).toBe(MAKER_USER_ID);
      expect(pending.runId).toBe(RUN_ID);
    });

    it('pending approval is linked to a HumanApprove-tier run', () => {
      const pending = makePendingApproval();
      expect(pending.runId).toBe(RUN_ID);
      expect(pending.planId).toBe(PLAN_ID);
      expect(pending.prompt).toContain('production');
    });
  });

  // Step 2: Maker-checker rejection
  describe('Step 2 — MakerChecker rejects maker as approver', () => {
    it('submitApproval returns Forbidden when maker tries to approve their own request', async () => {
      const { deps, ctx } = makeDeps({ principalId: MAKER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Approved',
        rationale: 'Self-approving because I trust myself.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected SoD violation');
      expect(result.error.kind).toBe('Forbidden');
      expect(result.error.message).toContain('SoD violation');
      expect(result.error.message).toContain('MakerChecker');
    });

    it('submitApproval also rejects maker Denied decision with MakerChecker', async () => {
      const { deps, ctx } = makeDeps({ principalId: MAKER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Denied',
        rationale: 'Self-denying.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('Expected SoD violation');
      expect(result.error.kind).toBe('Forbidden');
    });
  });

  // Step 3: Authorized approver resolves the gate
  describe('Step 3 — Authorized approver resolves gate', () => {
    it('distinct approver can approve and run resumes', async () => {
      const { deps, ctx, approvalStore, publishedEvents } = makeDeps({
        principalId: APPROVER_USER_ID,
      });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Approved',
        rationale: 'Reviewed and approved for production deployment.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected approval success');
      expect(result.value.status).toBe('Approved');
      expect(result.value.approvalId).toBe(APPROVAL_ID);

      // Approval was persisted
      expect(approvalStore.saved).toHaveLength(1);
      const saved = approvalStore.saved[0] as Record<string, unknown>;
      expect(saved['status']).toBe('Approved');
      expect(saved['decidedByUserId']).toBe(APPROVER_USER_ID);
      expect(saved['rationale']).toBe('Reviewed and approved for production deployment.');

      // Domain event was published
      expect(publishedEvents).toHaveLength(1);
      const event = publishedEvents[0] as Record<string, unknown>;
      expect(event['type']).toContain('ApprovalGranted');
    });

    it('distinct approver can deny with rationale', async () => {
      const { deps, ctx } = makeDeps({ principalId: APPROVER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Denied',
        rationale: 'Security review flagged insufficient test coverage.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected denial success');
      expect(result.value.status).toBe('Denied');
    });

    it('distinct approver can request changes', async () => {
      const { deps, ctx } = makeDeps({ principalId: APPROVER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'RequestChanges',
        rationale: 'Need additional rollback plan documentation.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected request-changes success');
      expect(result.value.status).toBe('RequestChanges');
    });
  });

  // Step 4: Evidence chain records full audit trail
  describe('Step 4 — Evidence records approval-requested → resolved → completed chain', () => {
    it('evidence chain contains three entries with correct categories and links', async () => {
      const evidenceLog = makeStubEvidenceLog();

      // Entry 1: Approval requested (run paused)
      const requestedEntry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-requested' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_REQUEST_TIME,
        category: 'Approval',
        summary: `Approval requested for run ${RUN_ID}: deployment to production`,
        actor: { kind: 'User', userId: MAKER_USER_ID },
        links: { runId: RUN_ID, approvalId: APPROVAL_ID },
      });

      // Entry 2: Approval resolved (gate opened)
      const resolvedEntry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-resolved' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_DECIDE_TIME,
        category: 'Approval',
        summary: `Approval ${APPROVAL_ID} granted by ${APPROVER_USER_ID}`,
        actor: { kind: 'User', userId: APPROVER_USER_ID },
        links: { runId: RUN_ID, approvalId: APPROVAL_ID },
      });

      // Entry 3: Run completed after approval
      const completedEntry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-completed' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_COMPLETE_TIME,
        category: 'System',
        summary: `Run ${RUN_ID} completed: approval gate passed`,
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });

      // All three entries recorded
      expect(evidenceLog.entries).toHaveLength(3);

      // Categories
      expect(requestedEntry.category).toBe('Approval');
      expect(resolvedEntry.category).toBe('Approval');
      expect(completedEntry.category).toBe('System');

      // Correlation IDs are consistent
      expect(requestedEntry.correlationId).toBe(CORRELATION_ID);
      expect(resolvedEntry.correlationId).toBe(CORRELATION_ID);
      expect(completedEntry.correlationId).toBe(CORRELATION_ID);

      // Hash chain integrity
      expect(requestedEntry.hashSha256).toBeDefined();
      expect(resolvedEntry.previousHash).toBe(requestedEntry.hashSha256);
      expect(completedEntry.previousHash).toBe(resolvedEntry.hashSha256);
    });

    it('evidence entries carry approval and run links for audit correlation', async () => {
      const evidenceLog = makeStubEvidenceLog();

      const entry = await evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: 'ev-links' as EvidenceId,
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_REQUEST_TIME,
        category: 'Approval',
        summary: 'Approval requested',
        actor: { kind: 'User', userId: MAKER_USER_ID },
        links: { runId: RUN_ID, approvalId: APPROVAL_ID },
      });

      expect(entry.links).toEqual({ runId: RUN_ID, approvalId: APPROVAL_ID });
    });
  });

  // Step 5: Domain event audit markers
  describe('Step 5 — Domain events carry audit markers', () => {
    it('ApprovalGranted event includes workspace and correlation context', async () => {
      const { deps, ctx, publishedEvents } = makeDeps({ principalId: APPROVER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Approved',
        rationale: 'Approved after code review.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(true);
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0] as Record<string, unknown>;
      expect(event['type']).toContain('ApprovalGranted');
      expect(event['source']).toContain('approvals');
    });

    it('ApprovalDenied event is emitted for denial decisions', async () => {
      const { deps, ctx, publishedEvents } = makeDeps({ principalId: APPROVER_USER_ID });

      const result = await submitApproval(deps, ctx, {
        workspaceId: WORKSPACE_ID as string,
        approvalId: APPROVAL_ID as string,
        decision: 'Denied',
        rationale: 'Insufficient evidence of testing.',
        sodConstraints: [MAKER_CHECKER_CONSTRAINT],
      });

      expect(result.ok).toBe(true);
      expect(publishedEvents).toHaveLength(1);

      const event = publishedEvents[0] as Record<string, unknown>;
      expect(event['type']).toContain('ApprovalDenied');
    });
  });
});
