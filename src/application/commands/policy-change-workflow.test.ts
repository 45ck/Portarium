import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HashSha256 } from '../../domain/primitives/index.js';
import { InMemoryPolicyStore } from '../../infrastructure/stores/in-memory-policy-store.js';
import { toAppContext } from '../common/context.js';
import type {
  AuthorizationPort,
  Clock,
  EventPublisher,
  EvidenceLogPort,
  IdGenerator,
  UnitOfWork,
} from '../ports/index.js';
import {
  approvePolicyChange,
  proposePolicyChange,
  rollbackPolicyChange,
  type PolicyChangeWorkflowDeps,
} from './policy-change-workflow.js';

const POLICY = {
  schemaVersion: 1,
  policyId: 'pol-1',
  workspaceId: 'ws-1',
  name: 'Payments policy',
  active: true,
  priority: 10,
  version: 1,
  createdAtIso: '2026-01-01T00:00:00.000Z',
  createdByUserId: 'author-1',
};

const PROPOSED = {
  ...POLICY,
  version: 2,
  rules: [{ ruleId: 'rule-1', condition: 'amount > 10000', effect: 'Deny' }],
};

describe('policy change workflow commands', () => {
  let authorization: AuthorizationPort;
  let clock: Clock;
  let idGenerator: IdGenerator;
  let policyStore: InMemoryPolicyStore;
  let unitOfWork: UnitOfWork;
  let eventPublisher: EventPublisher;
  let evidenceLog: EvidenceLogPort;
  let deps: PolicyChangeWorkflowDeps;
  let idCounter: number;

  beforeEach(async () => {
    idCounter = 0;
    authorization = { isAllowed: vi.fn(async () => true) };
    clock = { nowIso: vi.fn(() => '2026-02-01T10:00:00.000Z') };
    idGenerator = {
      generateId: vi.fn(() => {
        idCounter += 1;
        return `gen-${idCounter}`;
      }),
    };
    policyStore = new InMemoryPolicyStore();
    await policyStore.savePolicy('tenant-1' as never, 'ws-1' as never, POLICY as never);
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
    eventPublisher = { publish: vi.fn(async () => undefined) };
    evidenceLog = {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        previousHash: HashSha256(''),
        hashSha256: HashSha256('hash'),
      })),
    };
    deps = {
      authorization,
      clock,
      idGenerator,
      policyStore,
      unitOfWork,
      eventPublisher,
      evidenceLog,
    };
  });

  function ctx(principalId = 'maker-1') {
    return toAppContext({
      tenantId: 'tenant-1',
      principalId,
      roles: ['admin'],
      correlationId: 'corr-1',
    });
  }

  async function proposeHighRisk() {
    return proposePolicyChange(deps, ctx('maker-1'), {
      workspaceId: 'ws-1',
      policyId: 'pol-1',
      operation: 'Update',
      risk: 'High',
      scope: { targetKind: 'ActionClass', workspaceId: 'ws-1', actionClass: 'payments.write' },
      proposedPolicy: PROPOSED,
      rationale: 'High-value payment actions need a stricter policy.',
      diff: [{ path: '/rules/0', before: null, after: PROPOSED.rules[0] }],
      runEffect: 'FutureRunsOnly',
      effectiveFromIso: '2026-02-01T11:00:00.000Z',
      approvalId: 'approval-1',
    });
  }

  it('stores high-risk policy changes as pending approval with audit and evidence', async () => {
    const result = await proposeHighRisk();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected policy change proposal to succeed.');
    expect(result.value.status).toBe('PendingApproval');
    expect(result.value.approvalRequired).toBe(true);

    const change = await policyStore.getPolicyChangeById(
      'tenant-1' as never,
      'ws-1' as never,
      result.value.policyChangeId,
    );
    expect(change?.rationale).toContain('High-value');
    expect(change?.scope).toMatchObject({
      targetKind: 'ActionClass',
      actionClass: 'payments.write',
    });

    const audit = await policyStore.listPolicyChangeAuditEntries(
      'tenant-1' as never,
      'ws-1' as never,
      result.value.policyChangeId,
    );
    expect(audit[0]).toMatchObject({
      eventType: 'PolicyChangeProposed',
      actorUserId: 'maker-1',
      policyVersion: 2,
    });
    expect(evidenceLog.appendEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ category: 'Policy' }),
    );
  });

  it('requires separation of duties before a high-risk policy change is applied', async () => {
    const proposed = await proposeHighRisk();
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error('Expected proposal success.');

    const selfApproval = await approvePolicyChange(deps, ctx('maker-1'), {
      workspaceId: 'ws-1',
      policyChangeId: String(proposed.value.policyChangeId),
      approvalId: 'approval-1',
      rationale: 'Approving my own edit.',
    });
    expect(selfApproval.ok).toBe(false);
    if (selfApproval.ok) throw new Error('Expected maker-checker rejection.');
    expect(selfApproval.error.kind).toBe('Conflict');

    const approved = await approvePolicyChange(deps, ctx('checker-1'), {
      workspaceId: 'ws-1',
      policyChangeId: String(proposed.value.policyChangeId),
      approvalId: 'approval-1',
      rationale: 'Finance checker reviewed the diff and rationale.',
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('Expected approval success.');
    expect(approved.value.status).toBe('Applied');

    const current = await policyStore.getPolicyById(
      'tenant-1' as never,
      'ws-1' as never,
      'pol-1' as never,
    );
    expect(current?.version).toBe(2);
  });

  it('applies standard-risk changes immediately and records why they were allowed', async () => {
    const result = await proposePolicyChange(deps, ctx('maker-1'), {
      workspaceId: 'ws-1',
      policyId: 'pol-1',
      operation: 'Update',
      risk: 'Standard',
      scope: { targetKind: 'Workspace', workspaceId: 'ws-1' },
      proposedPolicy: { ...PROPOSED, version: 3 },
      rationale: 'Clarify the workspace policy name.',
      diff: [{ path: '/name', before: POLICY.name, after: 'Updated payments policy' }],
      runEffect: 'ActiveAndFutureRuns',
      effectiveFromIso: '2026-02-01T10:00:00.000Z',
      approvalRequired: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected standard change success.');
    expect(result.value.status).toBe('Applied');
    const audit = await policyStore.listPolicyChangeAuditEntries(
      'tenant-1' as never,
      'ws-1' as never,
      result.value.policyChangeId,
    );
    expect(audit[0]?.eventType).toBe('PolicyChangeApplied');
    expect(audit[0]?.rationale).toContain('Clarify');
  });

  it('rolls back an applied change as a first-class linked policy change', async () => {
    const proposed = await proposeHighRisk();
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error('Expected proposal success.');
    const approved = await approvePolicyChange(deps, ctx('checker-1'), {
      workspaceId: 'ws-1',
      policyChangeId: String(proposed.value.policyChangeId),
      approvalId: 'approval-1',
      rationale: 'Approved.',
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('Expected approval success.');

    const rollback = await rollbackPolicyChange(deps, ctx('operator-1'), {
      workspaceId: 'ws-1',
      targetPolicyChangeId: String(proposed.value.policyChangeId),
      rationale: 'Rollback after the finance team found the scope was too broad.',
      effectiveFromIso: '2026-02-01T12:00:00.000Z',
      approvalId: 'approval-rollback-1',
    });

    expect(rollback.ok).toBe(true);
    if (!rollback.ok) throw new Error('Expected rollback proposal success.');
    expect(rollback.value.status).toBe('PendingApproval');

    const rollbackChange = await policyStore.getPolicyChangeById(
      'tenant-1' as never,
      'ws-1' as never,
      rollback.value.policyChangeId,
    );
    expect(rollbackChange?.operation).toBe('Rollback');
    expect(rollbackChange?.rollbackOfPolicyChangeId).toBe(proposed.value.policyChangeId);
  });
});
