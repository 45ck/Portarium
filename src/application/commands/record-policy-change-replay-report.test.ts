import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HashSha256 } from '../../domain/primitives/index.js';
import { parsePolicyChangeRequestV1 } from '../../domain/policy/index.js';
import { InMemoryPolicyStore } from '../../infrastructure/stores/in-memory-policy-store.js';
import { toAppContext } from '../common/context.js';
import type {
  ApprovalQueryStore,
  AuthorizationPort,
  EvidenceLogPort,
  HumanTaskStore,
  IdGenerator,
  RunQueryStore,
  UnitOfWork,
} from '../ports/index.js';
import { recordPolicyChangeReplayReport } from './record-policy-change-replay-report.js';
import { previewPolicyChangeReplay } from '../queries/preview-policy-change-replay.js';

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
  rules: [{ ruleId: 'allow-small', condition: 'estimatedCostCents < 10000', effect: 'Allow' }],
} as const;

const PROPOSED = {
  ...POLICY,
  version: 2,
  rules: [{ ruleId: 'deny-large', condition: 'estimatedCostCents >= 10000', effect: 'Deny' }],
} as const;

const CHANGE = parsePolicyChangeRequestV1({
  schemaVersion: 1,
  policyChangeId: 'pc-1',
  policyId: 'pol-1',
  workspaceId: 'ws-1',
  operation: 'Update',
  risk: 'High',
  status: 'PendingApproval',
  scope: { targetKind: 'ActionClass', workspaceId: 'ws-1', actionClass: 'payments.write' },
  basePolicy: POLICY,
  proposedPolicy: PROPOSED,
  proposedAtIso: '2026-02-01T09:00:00.000Z',
  proposedByUserId: 'maker-1',
  rationale: 'Block high-value payment automation.',
  diff: [{ path: '/rules/0', before: null, after: PROPOSED.rules[0] }],
  runEffect: 'FutureRunsOnly',
  effectiveFromIso: '2026-02-01T11:00:00.000Z',
  approval: { approvalRequired: true, approvalId: 'approval-1' },
  activationRequirements: { replayReportRequired: true },
});

describe('policy change replay report application flow', () => {
  let authorization: AuthorizationPort;
  let policyStore: InMemoryPolicyStore;
  let runStore: RunQueryStore;
  let approvalStore: ApprovalQueryStore;
  let humanTaskStore: Pick<HumanTaskStore, 'listHumanTasks'>;
  let evidenceLog: EvidenceLogPort;
  let idGenerator: IdGenerator;
  let unitOfWork: UnitOfWork;

  beforeEach(async () => {
    authorization = { isAllowed: vi.fn(async () => true) };
    policyStore = new InMemoryPolicyStore();
    await policyStore.savePolicy('tenant-1' as never, 'ws-1' as never, POLICY as never);
    await policyStore.savePolicyChange('tenant-1' as never, 'ws-1' as never, CHANGE);
    runStore = {
      listRuns: vi.fn(async () => ({
        items: [
          {
            schemaVersion: 1,
            runId: 'run-1',
            workspaceId: 'ws-1',
            workflowId: 'workflow-1',
            correlationId: 'corr-run-1',
            executionTier: 'Assisted',
            initiatedByUserId: 'maker-1',
            status: 'Running',
            createdAtIso: '2026-02-01T08:30:00.000Z',
            startedAtIso: '2026-02-01T09:00:00.000Z',
            estimatedCostCents: 15000,
          } as never,
        ],
      })),
    };
    approvalStore = {
      listApprovals: vi.fn(async () => ({
        items: [
          {
            schemaVersion: 1,
            approvalId: 'approval-recent-1',
            workspaceId: 'ws-1',
            runId: 'run-2',
            planId: 'plan-1',
            prompt: 'Approve payment',
            requestedAtIso: '2026-02-01T08:00:00.000Z',
            requestedByUserId: 'maker-1',
            dueAtIso: '2026-02-01T09:00:00.000Z',
            status: 'Pending',
            estimatedCostCents: 5000,
          } as never,
        ],
      })),
    };
    humanTaskStore = {
      listHumanTasks: vi.fn(async () => ({
        items: [
          {
            schemaVersion: 1,
            humanTaskId: 'task-1',
            workItemId: 'work-1',
            runId: 'run-3',
            stepId: 'action-1',
            description: 'Manual payment review',
            requiredCapabilities: ['finance.approve'],
            status: 'pending',
            dueAt: '2026-02-01T09:30:00.000Z',
          } as never,
        ],
      })),
    };
    evidenceLog = {
      appendEntry: vi.fn(async (_tenantId, entry) => ({
        ...entry,
        previousHash: HashSha256(''),
        hashSha256: HashSha256('hash'),
      })),
    };
    idGenerator = { generateId: vi.fn(() => 'evi-replay-1') };
    unitOfWork = { execute: vi.fn(async (fn) => fn()) };
  });

  function ctx() {
    return toAppContext({
      tenantId: 'tenant-1',
      principalId: 'policy-owner-1',
      roles: ['admin'],
      correlationId: 'corr-1',
    });
  }

  it('previews replay as a read-only query for Cockpit policy simulation', async () => {
    const savePolicyChange = vi.spyOn(policyStore, 'savePolicyChange');

    const result = await previewPolicyChangeReplay(
      {
        authorization,
        clock: { nowIso: () => '2026-02-01T10:00:00.000Z' },
        policyStore,
        runStore,
        approvalStore,
        humanTaskStore,
      },
      ctx(),
      { workspaceId: 'ws-1', policyChangeId: 'pc-1', limit: 10 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected replay preview success.');
    expect(result.value.summary.blockedActionDelta).toBe(1);
    expect(result.value.metrics.denial_count).toBe(1);
    expect(evidenceLog.appendEntry).not.toHaveBeenCalled();
    expect(savePolicyChange).toHaveBeenCalledTimes(0);
  });

  it('records replay report evidence without mutating approval state or invoking live actions', async () => {
    const result = await recordPolicyChangeReplayReport(
      {
        authorization,
        clock: { nowIso: () => '2026-02-01T10:00:00.000Z' },
        idGenerator,
        policyStore,
        runStore,
        approvalStore,
        humanTaskStore,
        evidenceLog,
        unitOfWork,
      },
      ctx(),
      { workspaceId: 'ws-1', policyChangeId: 'pc-1', limit: 10 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected replay report record success.');
    expect(result.value.evidenceId).toBe('evi-replay-1');
    expect(evidenceLog.appendEntry).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        category: 'Policy',
        summary: expect.stringContaining('Policy replay report'),
      }),
    );
    expect(approvalStore.listApprovals).toHaveBeenCalledTimes(1);
    expect(runStore.listRuns).toHaveBeenCalledTimes(1);

    const stored = await policyStore.getPolicyChangeById(
      'tenant-1' as never,
      'ws-1' as never,
      'pc-1' as never,
    );
    expect(stored?.activationRequirements?.replayReportEvidenceId).toBe('evi-replay-1');
    expect(stored?.approval.approvedAtIso).toBeUndefined();
  });
});
