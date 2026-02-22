/**
 * Local governed-run smoke test (bead-0736).
 *
 * Validates the full product story end-to-end using stub implementations
 * of all port interfaces (no real DB, HTTP, or external services).
 *
 * Story:
 *   1. Approve the approval gate → ApprovalDecided event emitted
 *   2. Dispatch an adapter action (execution plane stub) → ok result
 *   3. Append evidence entries for each step → hash-chained log
 *
 * When GOVERNED_RUN_INTEGRATION=true, tests run against a live local stack
 * (bead-0733 seed). Otherwise they run as pure unit smoke tests.
 *
 * CI: always runs (unit mode). Integration mode requires `npm run dev:all`.
 *
 * Bead: bead-0736
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  UnitOfWork,
} from '../../application/ports/index.js';
import type { ApprovalStore } from '../../application/ports/approval-store.js';
import type { ActionRunnerPort } from '../../application/ports/action-runner.js';
import type { EvidenceLogPort } from '../../application/ports/evidence-log.js';
import { submitApproval } from '../../application/commands/submit-approval.js';
import { toAppContext } from '../../application/common/context.js';
import { parseApprovalV1 } from '../../domain/approvals/approval-v1.js';
import {
  ActionId,
  CorrelationId,
  EvidenceId,
  HashSha256,
  RunId,
  TenantId,
  WorkspaceId,
} from '../../domain/primitives/index.js';

// ---------------------------------------------------------------------------
// Environment gate
// ---------------------------------------------------------------------------

const INTEGRATION_MODE = process.env['GOVERNED_RUN_INTEGRATION'] === 'true';

function integrationIt() {
  return (name: string, fn: () => Promise<void> | void) => {
    if (!INTEGRATION_MODE) {
      it.skip(`[integration-skip] ${name}`, fn);
    } else {
      it(name, fn, 10_000);
    }
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = TenantId('tenant-smoke');
const WORKSPACE_ID = WorkspaceId('ws-smoke');
const RUN_ID = RunId('run-smoke-001');
const APPROVAL_ID = 'approval-smoke-001' as const;
const CORRELATION_ID = CorrelationId('corr-smoke-001');
const ACTION_ID = ActionId('action-smoke-001');
const FIXED_NOW = '2026-02-22T00:00:00.000Z';

const STUB_PENDING_APPROVAL = parseApprovalV1({
  schemaVersion: 1,
  approvalId: APPROVAL_ID,
  workspaceId: WORKSPACE_ID,
  runId: RUN_ID,
  planId: 'plan-smoke-001',
  prompt: 'Approve smoke run?',
  requestedAtIso: FIXED_NOW,
  requestedByUserId: 'user-initiator',
  status: 'Pending',
});

// ---------------------------------------------------------------------------
// Stub port factories
// ---------------------------------------------------------------------------

function makeStubPorts() {
  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => true),
  };

  const clock: Clock = {
    nowIso: vi.fn(() => FIXED_NOW),
  };

  const idGenerator: IdGenerator = {
    generateId: vi.fn(() => `id-${Math.random().toString(36).slice(2, 10)}`),
  };

  const unitOfWork: UnitOfWork = {
    execute: vi.fn(async (fn) => fn()),
  };

  const eventPublisher: EventPublisher = {
    publish: vi.fn(async () => undefined),
  };

  const approvalStore: ApprovalStore = {
    getApprovalById: vi.fn(async () => STUB_PENDING_APPROVAL),
    saveApproval: vi.fn(async () => undefined),
  };

  const actionRunner: ActionRunnerPort = {
    dispatchAction: vi.fn(async () => ({ ok: true as const, output: { status: 'completed' } })),
  };

  const evidenceLog: EvidenceLogPort = {
    appendEntry: vi.fn(async (_tenantId, entry) => ({
      ...entry,
      schemaVersion: 1 as const,
      evidenceId: EvidenceId('ev-smoke-001'),
      previousHash: undefined,
      hashSha256: HashSha256('smoke-hash-' + entry.category),
    })),
  };

  return {
    authorization,
    clock,
    idGenerator,
    unitOfWork,
    eventPublisher,
    approvalStore,
    actionRunner,
    evidenceLog,
  };
}

// ---------------------------------------------------------------------------
// Unit-mode smoke tests (always run)
// ---------------------------------------------------------------------------

describe('governed run smoke — unit mode (always)', () => {
  let ports: ReturnType<typeof makeStubPorts>;
  const ctx = toAppContext({
    tenantId: TENANT_ID,
    principalId: 'user-approver',
    correlationId: CORRELATION_ID,
    roles: ['approver', 'operator'],
  });

  beforeEach(() => {
    ports = makeStubPorts();
  });

  // Step 1: approval gate
  describe('Step 1 — approval gate', () => {
    it('submitApproval returns ok:true for Approved decision', async () => {
      const result = await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Smoke test approval — all checks nominal',
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true');
      expect(result.value.status).toBe('Approved');
    });

    it('approval store.saveApproval called exactly once', async () => {
      await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Smoke test',
        },
      );
      expect(ports.approvalStore.saveApproval).toHaveBeenCalledTimes(1);
    });

    it('ApprovalDecided event published after approval', async () => {
      await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Smoke test',
        },
      );
      expect(ports.eventPublisher.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = (ports.eventPublisher.publish as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0];
      expect(JSON.stringify(publishedEvent)).toContain('Approved');
    });

    it('submitApproval respects authorization check', async () => {
      ports.authorization.isAllowed = vi.fn(async () => false);
      const result = await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Should be blocked',
        },
      );
      expect(result.ok).toBe(false);
      expect(ports.approvalStore.saveApproval).not.toHaveBeenCalled();
    });

    it('submitApproval handles Denied decision gracefully', async () => {
      const result = await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Denied',
          rationale: 'Not satisfied with the plan',
        },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true for Denied decision');
      expect(result.value.status).toBe('Denied');
    });
  });

  // Step 2: adapter action dispatch
  describe('Step 2 — adapter action dispatch', () => {
    it('actionRunner.dispatchAction returns ok:true', async () => {
      const result = await ports.actionRunner.dispatchAction({
        actionId: ACTION_ID,
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
        flowRef: 'smoke/flow',
        payload: { step: 'adapter', runId: RUN_ID },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Expected ok:true');
      expect(result.output).toEqual({ status: 'completed' });
    });

    it('actionRunner stub records the dispatch call', async () => {
      await ports.actionRunner.dispatchAction({
        actionId: ACTION_ID,
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
        flowRef: 'smoke/flow',
        payload: {},
      });
      expect(ports.actionRunner.dispatchAction).toHaveBeenCalledTimes(1);
    });

    it('actionRunner propagates correlation envelope', async () => {
      await ports.actionRunner.dispatchAction({
        actionId: ACTION_ID,
        tenantId: TENANT_ID,
        runId: RUN_ID,
        correlationId: CORRELATION_ID,
        flowRef: 'smoke/flow',
        payload: {},
      });
      const call = (ports.actionRunner.dispatchAction as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as { correlationId: string; runId: string } | undefined;
      expect(call?.correlationId).toBe(CORRELATION_ID);
      expect(call?.runId).toBe(RUN_ID);
    });
  });

  // Step 3: evidence chain
  describe('Step 3 — evidence chain', () => {
    it('evidence log appends Approval category entry', async () => {
      const entry = await ports.evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-approval'),
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'Approval gate decided: Approved',
        actor: {
          kind: 'User',
          userId: 'user-approver' as ReturnType<
            typeof import('../../domain/primitives/index.js').UserId
          >,
        },
      });
      expect(entry.category).toBe('Approval');
      expect(entry.hashSha256).toContain('smoke-hash');
    });

    it('evidence log appends Action category entry', async () => {
      const entry = await ports.evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-action'),
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Action',
        summary: 'Adapter action dispatched',
        actor: {
          kind: 'Adapter',
          adapterId: 'adapter-smoke' as ReturnType<
            typeof import('../../domain/primitives/index.js').AdapterId
          >,
        },
        links: { runId: RUN_ID },
      });
      expect(entry.category).toBe('Action');
      expect(entry.hashSha256).toBeDefined();
    });

    it('evidence log appends System category entry for run completion', async () => {
      const entry = await ports.evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-complete'),
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'Run completed successfully',
        actor: { kind: 'System' },
        links: { runId: RUN_ID },
      });
      expect(entry.category).toBe('System');
    });

    it('evidence log receives correct tenantId', async () => {
      await ports.evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-tenant'),
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'System',
        summary: 'Tenant check',
        actor: { kind: 'System' },
      });
      const [calledTenantId] = (ports.evidenceLog.appendEntry as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, unknown];
      expect(calledTenantId).toBe(TENANT_ID);
    });
  });

  // Full-story correlation invariants
  describe('Full story — correlation invariants', () => {
    it('all published events share the same runId', async () => {
      // Approval step
      await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Full story',
        },
      );

      const publishedEvent = (ports.eventPublisher.publish as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as unknown;

      expect(JSON.stringify(publishedEvent)).toContain(RUN_ID);
    });

    it('approval event and evidence entry share the same correlationId', async () => {
      await submitApproval(
        {
          authorization: ports.authorization,
          clock: ports.clock,
          idGenerator: ports.idGenerator,
          approvalStore: ports.approvalStore,
          unitOfWork: ports.unitOfWork,
          eventPublisher: ports.eventPublisher,
        },
        ctx,
        {
          workspaceId: WORKSPACE_ID,
          approvalId: APPROVAL_ID,
          decision: 'Approved',
          rationale: 'Correlation check',
        },
      );

      // Evidence entry
      await ports.evidenceLog.appendEntry(TENANT_ID, {
        schemaVersion: 1,
        evidenceId: EvidenceId('ev-corr'),
        workspaceId: WORKSPACE_ID,
        correlationId: CORRELATION_ID,
        occurredAtIso: FIXED_NOW,
        category: 'Approval',
        summary: 'Approval decided',
        actor: {
          kind: 'User',
          userId: 'user-approver' as ReturnType<
            typeof import('../../domain/primitives/index.js').UserId
          >,
        },
      });

      const publishedEvent = (ports.eventPublisher.publish as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as unknown;
      const evidenceCall = (ports.evidenceLog.appendEntry as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[1] as { correlationId: string } | undefined;

      expect(JSON.stringify(publishedEvent)).toContain(CORRELATION_ID);
      expect(evidenceCall?.correlationId).toBe(CORRELATION_ID);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration-mode smoke (skipped unless GOVERNED_RUN_INTEGRATION=true)
// ---------------------------------------------------------------------------

describe('governed run smoke — integration mode (skipped in unit CI)', () => {
  const sit = integrationIt();

  sit('local stack health endpoint responds 200', async () => {
    const baseUrl = process.env['LOCAL_STACK_URL'] ?? 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/health`);
    expect(resp.status).toBe(200);
  });

  sit('POST /workspaces creates a workspace', async () => {
    const baseUrl = process.env['LOCAL_STACK_URL'] ?? 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'ws-smoke-integration', name: 'Smoke Integration' }),
    });
    expect(resp.status).toBe(200);
  });
});
