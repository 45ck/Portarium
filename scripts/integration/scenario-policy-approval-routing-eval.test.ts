/**
 * Scenario: policy approval routing eval.
 *
 * This is a deterministic matrix for the governance decisions that decide
 * whether an autonomous Run can continue directly or must wait for a human
 * Approval Gate.
 */

import { describe, expect, it } from 'vitest';

import { proposeAgentAction } from '../../src/application/commands/propose-agent-action.js';
import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { toAppContext } from '../../src/application/common/context.js';
import type {
  ApprovalStore,
  AuthorizationPort,
  Clock,
  EventPublisher,
  IdGenerator,
  PolicyStore,
  UnitOfWork,
} from '../../src/application/ports/index.js';
import type { ApprovalStatus, ApprovalV1 } from '../../src/domain/approvals/index.js';
import type { PortariumCloudEventV1 } from '../../src/domain/event-stream/cloudevents-v1.js';
import {
  ENVIRONMENT_TIER_DEFAULTS,
  evaluateExecutionTierPolicy,
  type EnvironmentTier,
} from '../../src/domain/policy/execution-tier-policy-v1.js';
import type { PolicyV1 } from '../../src/domain/policy/policy-v1.js';
import { determineRequiredApprovals } from '../../src/domain/services/approval-routing.js';
import type { WorkflowV1 } from '../../src/domain/workflows/workflow-v1.js';
import {
  ActionId,
  PolicyId,
  TenantId,
  UserId,
  WorkflowId,
  WorkspaceId,
  type ApprovalId as ApprovalIdType,
  type ExecutionTier,
  type PolicyId as PolicyIdType,
  type TenantId as TenantIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../src/domain/primitives/index.js';
import { InMemoryAgentActionProposalStore } from '../../src/infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { InMemoryEvidenceLog } from '../../src/infrastructure/stores/in-memory-evidence-log.js';

const workspaceId = WorkspaceId('ws-policy-eval');
const tenantId = TenantId('ws-policy-eval');
const initiatorUserId = UserId('operator-1');
const approverUserId = UserId('approver-1');
const fixedNowIso = '2026-05-01T00:00:00.000Z';

function makeWorkflow(tier: ExecutionTier, actionTier?: ExecutionTier): WorkflowV1 {
  return {
    schemaVersion: 1,
    workflowId: WorkflowId(`workflow-${tier}-${actionTier ?? 'base'}`),
    workspaceId,
    name: `Policy eval ${tier}`,
    version: 1,
    active: true,
    executionTier: tier,
    actions: [
      {
        actionId: ActionId(`action-${tier}-${actionTier ?? 'base'}`),
        order: 1,
        portFamily: 'CommsCollaboration',
        operation: 'message:send',
        ...(actionTier ? { executionTierOverride: actionTier } : {}),
      },
    ],
  };
}

function makePolicy(sodConstraints?: PolicyV1['sodConstraints']): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: PolicyId('policy-routing-eval'),
    workspaceId,
    name: 'Routing eval policy',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-05-01T00:00:00.000Z',
    createdByUserId: UserId('policy-admin-1'),
    ...(sodConstraints ? { sodConstraints } : {}),
  };
}

class EvalPolicyStore implements PolicyStore {
  readonly #policies: ReadonlyMap<string, PolicyV1>;

  public constructor(policies: readonly PolicyV1[]) {
    this.#policies = new Map(policies.map((policy) => [String(policy.policyId), policy]));
  }

  public async getPolicyById(
    _tenantId: TenantIdType,
    requestedWorkspaceId: WorkspaceIdType,
    policyId: PolicyIdType,
  ): Promise<PolicyV1 | null> {
    const policy = this.#policies.get(String(policyId)) ?? null;
    return policy && String(policy.workspaceId) === String(requestedWorkspaceId) ? policy : null;
  }

  public async savePolicy(): Promise<void> {
    throw new Error('EvalPolicyStore is read-only.');
  }
}

class EvalApprovalStore implements ApprovalStore {
  readonly #approvals = new Map<string, ApprovalV1>();

  public readonly saved: ApprovalV1[] = [];

  public async getApprovalById(
    requestedTenantId: TenantIdType,
    requestedWorkspaceId: WorkspaceIdType,
    approvalId: ApprovalIdType,
  ): Promise<ApprovalV1 | null> {
    return (
      this.#approvals.get(this.#key(requestedTenantId, requestedWorkspaceId, approvalId)) ?? null
    );
  }

  public async saveApproval(requestedTenantId: TenantIdType, approval: ApprovalV1): Promise<void> {
    this.#approvals.set(
      this.#key(requestedTenantId, approval.workspaceId, approval.approvalId),
      approval,
    );
    this.saved.push(approval);
  }

  public async saveApprovalIfStatus(
    requestedTenantId: TenantIdType,
    requestedWorkspaceId: WorkspaceIdType,
    approvalId: ApprovalIdType,
    expectedStatus: ApprovalStatus,
    approval: ApprovalV1,
  ): Promise<boolean> {
    const key = this.#key(requestedTenantId, requestedWorkspaceId, approvalId);
    const current = this.#approvals.get(key);
    if (current?.status !== expectedStatus) return false;
    this.#approvals.set(key, approval);
    this.saved.push(approval);
    return true;
  }

  #key(
    requestedTenantId: TenantIdType,
    requestedWorkspaceId: WorkspaceIdType,
    approvalId: ApprovalIdType,
  ): string {
    return `${String(requestedTenantId)}:${String(requestedWorkspaceId)}:${String(approvalId)}`;
  }
}

class CapturingPublisher implements EventPublisher {
  public readonly published: PortariumCloudEventV1[] = [];

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    this.published.push(event);
  }
}

function makeHarness(policies: readonly PolicyV1[] = [makePolicy()]) {
  let nextId = 0;
  const approvalStore = new EvalApprovalStore();
  const proposalStore = new InMemoryAgentActionProposalStore();
  const publisher = new CapturingPublisher();
  const evidenceLog = new InMemoryEvidenceLog();

  const authorization: AuthorizationPort = { isAllowed: async () => true };
  const clock: Clock = { nowIso: () => fixedNowIso };
  const idGenerator: IdGenerator = {
    generateId: () => {
      nextId += 1;
      return `policy-routing-eval-${nextId}`;
    },
  };
  const unitOfWork: UnitOfWork = { execute: async (fn) => fn() };

  return {
    deps: {
      authorization,
      clock,
      idGenerator,
      unitOfWork,
      policyStore: new EvalPolicyStore(policies),
      approvalStore,
      proposalStore,
      eventPublisher: publisher,
      evidenceLog,
    },
    approvalStore,
    publisher,
  };
}

function appContext(principalId: string) {
  return toAppContext({
    tenantId: String(tenantId),
    principalId,
    roles: ['operator', 'approver'],
    correlationId: 'corr-policy-routing-eval',
  });
}

function proposalInput(overrides: {
  agentId: string;
  actionKind: string;
  toolName: string;
  executionTier: ExecutionTier;
  rationale: string;
  idempotencyKey: string;
}) {
  return {
    workspaceId: String(workspaceId),
    policyIds: [String(PolicyId('policy-routing-eval'))],
    ...overrides,
  };
}

describe('Scenario: policy approval routing eval', () => {
  it.each([
    ['dev', 'Auto', 'Allow'],
    ['dev', 'HumanApprove', 'Allow'],
    ['dev', 'ManualOnly', 'Deny'],
    ['staging', 'Assisted', 'Allow'],
    ['staging', 'HumanApprove', 'RequireApproval'],
    ['staging', 'ManualOnly', 'Deny'],
    ['prod', 'Auto', 'Allow'],
    ['prod', 'Assisted', 'RequireApproval'],
    ['prod', 'HumanApprove', 'RequireApproval'],
  ] satisfies readonly [EnvironmentTier, ExecutionTier, string][])(
    'maps %s/%s to %s',
    (environmentTier, executionTier, expectedDecision) => {
      const result = evaluateExecutionTierPolicy({ environmentTier, executionTier });

      expect(result.decision).toBe(expectedDecision);
      expect(result.enforcement).toBe(ENVIRONMENT_TIER_DEFAULTS[environmentTier].enforcement);
    },
  );

  it('routes tier and SoD requirements into an approval packet', () => {
    const requirements = determineRequiredApprovals({
      workflow: makeWorkflow('HumanApprove'),
      initiatorUserId,
      policies: [
        makePolicy([{ kind: 'MakerChecker' }, { kind: 'DistinctApprovers', minimumApprovers: 2 }]),
      ],
    });

    expect(requirements).toEqual([
      { reason: 'ExecutionTierRequiresApproval', minimumApprovers: 1, excludedUserIds: [] },
      {
        reason: 'MakerCheckerRequired',
        minimumApprovers: 1,
        excludedUserIds: [initiatorUserId],
      },
      { reason: 'DistinctApproversRequired', minimumApprovers: 2, excludedUserIds: [] },
    ]);
  });

  it('routes action-level HumanApprove overrides even when the workflow is Assisted', () => {
    const requirements = determineRequiredApprovals({
      workflow: makeWorkflow('Assisted', 'HumanApprove'),
      initiatorUserId,
      policies: [],
    });

    expect(requirements).toEqual([
      { reason: 'ExecutionTierRequiresApproval', minimumApprovers: 1, excludedUserIds: [] },
    ]);
  });

  it('applies Allow, NeedsApproval, Denied, maker-checker, approval, and denial decisions', async () => {
    const harness = makeHarness([makePolicy()]);

    const allow = await proposeAgentAction(harness.deps, appContext(String(initiatorUserId)), {
      ...proposalInput({
        agentId: 'agent-read',
        actionKind: 'comms:listMessages',
        toolName: 'message:list',
        executionTier: 'Auto',
        rationale: 'Read inbox metadata for routing.',
        idempotencyKey: 'eval-allow-read',
      }),
    });

    expect(allow.ok).toBe(true);
    if (!allow.ok) throw new Error('Expected read-only action to be allowed.');
    expect(allow.value.decision).toBe('Allow');
    expect(allow.value.approvalId).toBeUndefined();

    const needsApproval = await proposeAgentAction(
      harness.deps,
      appContext(String(initiatorUserId)),
      {
        ...proposalInput({
          agentId: 'agent-send-deny',
          actionKind: 'comms:sendMessage',
          toolName: 'message:send',
          executionTier: 'HumanApprove',
          rationale: 'Send customer-facing update after policy review.',
          idempotencyKey: 'eval-needs-approval-deny',
        }),
      },
    );

    expect(needsApproval.ok).toBe(true);
    if (!needsApproval.ok) throw new Error('Expected mutation action to need approval.');
    expect(needsApproval.value.decision).toBe('NeedsApproval');
    expect(needsApproval.value.approvalId).toBeDefined();

    const selfDecision = await submitApproval(harness.deps, appContext(String(initiatorUserId)), {
      workspaceId: String(workspaceId),
      approvalId: needsApproval.value.approvalId!,
      decision: 'Approved',
      rationale: 'Maker self-approval attempt.',
      sodConstraints: [{ kind: 'MakerChecker' }],
    });

    expect(selfDecision.ok).toBe(false);
    if (selfDecision.ok) throw new Error('Expected maker-checker rejection.');
    expect(selfDecision.error.kind).toBe('Forbidden');
    expect(selfDecision.error.message).toMatch(/maker-checker/i);

    const denied = await submitApproval(harness.deps, appContext(String(approverUserId)), {
      workspaceId: String(workspaceId),
      approvalId: needsApproval.value.approvalId!,
      decision: 'Denied',
      rationale: 'Customer-facing text requires revision.',
      sodConstraints: [{ kind: 'MakerChecker' }],
    });

    expect(denied.ok).toBe(true);
    if (!denied.ok) throw new Error('Expected distinct approver denial.');
    expect(denied.value.status).toBe('Denied');
    expect(harness.publisher.published.at(-1)?.type).toBe('com.portarium.approval.ApprovalDenied');

    const approvalCandidate = await proposeAgentAction(
      harness.deps,
      appContext(String(initiatorUserId)),
      {
        ...proposalInput({
          agentId: 'agent-send-approve',
          actionKind: 'comms:sendMessage',
          toolName: 'message:send',
          executionTier: 'HumanApprove',
          rationale: 'Send reviewed customer-facing update.',
          idempotencyKey: 'eval-needs-approval-approve',
        }),
      },
    );

    expect(approvalCandidate.ok).toBe(true);
    if (!approvalCandidate.ok) throw new Error('Expected second mutation action approval gate.');
    expect(approvalCandidate.value.decision).toBe('NeedsApproval');
    expect(approvalCandidate.value.approvalId).toBeDefined();

    const approved = await submitApproval(harness.deps, appContext(String(approverUserId)), {
      workspaceId: String(workspaceId),
      approvalId: approvalCandidate.value.approvalId!,
      decision: 'Approved',
      rationale: 'Reviewed plan and customer-facing copy.',
      sodConstraints: [{ kind: 'MakerChecker' }],
    });

    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('Expected distinct approver approval.');
    expect(approved.value.status).toBe('Approved');
    expect(harness.publisher.published.at(-1)?.type).toBe('com.portarium.approval.ApprovalGranted');

    const dangerous = await proposeAgentAction(harness.deps, appContext(String(initiatorUserId)), {
      ...proposalInput({
        agentId: 'agent-shell',
        actionKind: 'system:exec',
        toolName: 'shell:exec',
        executionTier: 'ManualOnly',
        rationale: 'Attempt host command execution.',
        idempotencyKey: 'eval-denied-dangerous',
      }),
    });

    expect(dangerous.ok).toBe(false);
    if (dangerous.ok) throw new Error('Expected dangerous action denial.');
    expect(dangerous.error.kind).toBe('Forbidden');
    expect(dangerous.error.message).toMatch(/Dangerous/);

    expect(harness.approvalStore.saved.map((approval) => approval.status)).toEqual([
      'Pending',
      'Denied',
      'Pending',
      'Approved',
    ]);
  });
});
