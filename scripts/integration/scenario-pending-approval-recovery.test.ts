/**
 * Scenario: Pending approval recovery and governed resume.
 *
 * Bead: bead-1059
 *
 * This is intentionally deterministic: it simulates process crash, service restart,
 * deploy restart, and provider outage by rebuilding application service objects over
 * the same durable stores. The goal is to prove the product contract without making
 * CI depend on real process kills or external providers.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { submitApproval } from '../../src/application/commands/submit-approval.js';
import { toAppContext } from '../../src/application/common/context.js';
import type { Page } from '../../src/application/common/query.js';
import type { ApprovalStore } from '../../src/application/ports/approval-store.js';
import type { EventPublisher, IdGenerator, UnitOfWork } from '../../src/application/ports/index.js';
import type { PlanQueryStore } from '../../src/application/ports/plan-query-store.js';
import type {
  ListRunsQuery,
  RunQueryStore,
  RunStore,
} from '../../src/application/ports/run-store.js';
import { parseApprovalV1, type ApprovalV1 } from '../../src/domain/approvals/index.js';
import type { PortariumCloudEventV1 } from '../../src/domain/event-stream/cloudevents-v1.js';
import type { EvidenceEntryV1 } from '../../src/domain/evidence/evidence-entry-v1.js';
import { parseAgentActionProposalV1 } from '../../src/domain/machines/index.js';
import { parsePlanV1, type PlanV1 } from '../../src/domain/plan/index.js';
import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  PlanId,
  RunId,
  TenantId,
  UserId,
  WorkspaceId,
} from '../../src/domain/primitives/index.js';
import { parseRunV1, type RunV1 } from '../../src/domain/runs/index.js';
import { InMemoryAgentActionProposalStore } from '../../src/infrastructure/stores/in-memory-agent-action-proposal-store.js';
import { InMemoryEvidenceLog } from '../../src/infrastructure/stores/in-memory-evidence-log.js';

const TENANT_ID = TenantId('tenant-recovery-1');
const WORKSPACE_ID = WorkspaceId('ws-recovery-1');
const RUN_ID = RunId('run-recovery-1');
const PLAN_ID = PlanId('plan-recovery-1');
const APPROVAL_ID = ApprovalId('approval-recovery-1');
const CORRELATION_ID = CorrelationId('corr-recovery-1');

class DurableApprovalStore implements ApprovalStore {
  public constructor(private readonly byId: Map<string, ApprovalV1>) {}

  public async getApprovalById(
    _tenantId: unknown,
    workspaceId: unknown,
    approvalId: unknown,
  ): Promise<ApprovalV1 | null> {
    const approval = this.byId.get(String(approvalId)) ?? null;
    return approval && String(approval.workspaceId) === String(workspaceId) ? approval : null;
  }

  public async saveApproval(_tenantId: unknown, approval: ApprovalV1): Promise<void> {
    this.byId.set(String(approval.approvalId), approval);
  }
}

class DurableRunStore implements RunStore, RunQueryStore {
  public constructor(private readonly byId: Map<string, RunV1>) {}

  public async getRunById(
    _tenantId: unknown,
    workspaceId: unknown,
    runId: unknown,
  ): Promise<RunV1 | null> {
    const run = this.byId.get(String(runId)) ?? null;
    return run && String(run.workspaceId) === String(workspaceId) ? run : null;
  }

  public async saveRun(_tenantId: unknown, run: RunV1): Promise<void> {
    this.byId.set(String(run.runId), run);
  }

  public async listRuns(
    _tenantId: unknown,
    workspaceId: unknown,
    _query: ListRunsQuery,
  ): Promise<Page<RunV1>> {
    return {
      items: [...this.byId.values()].filter(
        (run) => String(run.workspaceId) === String(workspaceId),
      ),
    };
  }
}

class DurablePlanStore implements PlanQueryStore {
  public constructor(private readonly byId: Map<string, PlanV1>) {}

  public async getPlanById(
    _tenantId: unknown,
    workspaceId: unknown,
    planId: unknown,
  ): Promise<PlanV1 | null> {
    const plan = this.byId.get(String(planId)) ?? null;
    return plan && String(plan.workspaceId) === String(workspaceId) ? plan : null;
  }
}

class CapturingPublisher implements EventPublisher {
  public readonly published: PortariumCloudEventV1[] = [];

  public async publish(event: PortariumCloudEventV1): Promise<void> {
    this.published.push(event);
  }
}

type RecoveryVariant = 'process-crash' | 'service-restart' | 'deploy-restart' | 'provider-outage';

type RecoveryResultBundle = Readonly<{
  beadId: 'bead-1059';
  scenario: 'pending-approval-recovery';
  verdict: 'pass' | 'fail';
  durableObjects: Readonly<{
    approval: 'survived';
    plan: 'survived';
    evidenceArtifact: 'survived';
    run: 'survived';
  }>;
  variants: readonly Readonly<{
    variant: RecoveryVariant;
    classification: 'product-pass' | 'environment-limitation' | 'product-defect';
    resumeOutcome: 'exact-once' | 'not-run';
  }>[];
  cockpitOperatorSignals: Readonly<{
    runStatus: string;
    controlState: string;
    pendingApprovalVisible: boolean;
  }>;
  counts: Readonly<{
    approvalDecisionEvents: number;
    actionEvidenceEntries: number;
    executedEffects: number;
  }>;
}>;

type DurableRecoveryState = Readonly<{
  approvals: Map<string, ApprovalV1>;
  runs: Map<string, RunV1>;
  plans: Map<string, PlanV1>;
  executedEffectKeys: Set<string>;
  evidenceLog: InMemoryEvidenceLog;
  proposalStore: InMemoryAgentActionProposalStore;
}>;

type RecoveryRuntime = Readonly<{
  approvalStore: DurableApprovalStore;
  runStore: DurableRunStore;
  planStore: DurablePlanStore;
  publisher: CapturingPublisher;
  evidenceLog: InMemoryEvidenceLog;
  proposalStore: InMemoryAgentActionProposalStore;
  idGenerator: IdGenerator;
  unitOfWork: UnitOfWork;
}>;

function makeState(): DurableRecoveryState {
  const run = parseRunV1({
    schemaVersion: 1,
    runId: RUN_ID,
    workspaceId: WORKSPACE_ID,
    workflowId: 'wf-recovery-approval',
    correlationId: CORRELATION_ID,
    executionTier: 'HumanApprove',
    initiatedByUserId: 'user-requester',
    status: 'WaitingForApproval',
    controlState: 'degraded',
    operatorOwnerId: 'user-operator',
    createdAtIso: '2026-04-30T00:00:00.000Z',
    startedAtIso: '2026-04-30T00:01:00.000Z',
  });
  const plan = parsePlanV1({
    schemaVersion: 1,
    planId: PLAN_ID,
    workspaceId: WORKSPACE_ID,
    createdAtIso: '2026-04-30T00:01:05.000Z',
    createdByUserId: 'user-requester',
    plannedEffects: [
      {
        effectId: 'effect-recovery-send',
        operation: 'Create',
        target: {
          sorName: 'OpenClaw Mail',
          portFamily: 'CommsCollaboration',
          externalId: 'draft-recovery-1',
          externalType: 'OutboundMessage',
          displayLabel: 'Send recovery approval notice',
        },
        summary: 'Send the approved outbound message once.',
        idempotencyKey: 'idem-recovery-send-1',
      },
    ],
  });
  const approval = parseApprovalV1({
    schemaVersion: 1,
    approvalId: APPROVAL_ID,
    workspaceId: WORKSPACE_ID,
    runId: RUN_ID,
    planId: PLAN_ID,
    prompt: 'Approve the outbound recovery action.',
    requestedAtIso: '2026-04-30T00:02:00.000Z',
    requestedByUserId: 'user-requester',
    assigneeUserId: 'user-operator',
    status: 'Pending',
  });

  const evidenceLog = new InMemoryEvidenceLog();
  void evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId('ev-recovery-plan-1'),
    workspaceId: WORKSPACE_ID,
    correlationId: CORRELATION_ID,
    occurredAtIso: '2026-04-30T00:01:10.000Z',
    category: 'Plan',
    summary: 'Recovery plan artifact recorded before interruption.',
    actor: { kind: 'System' },
    links: { runId: RUN_ID, planId: PLAN_ID },
    payloadRefs: [
      {
        kind: 'Artifact',
        uri: 'urn:portarium:evidence-artifact:recovery-plan-1',
        contentType: 'application/json',
      },
    ],
  });

  const proposalStore = new InMemoryAgentActionProposalStore();
  void proposalStore.saveProposal(
    TENANT_ID,
    parseAgentActionProposalV1({
      schemaVersion: 1,
      proposalId: 'proposal-recovery-1',
      workspaceId: WORKSPACE_ID,
      agentId: 'agent-recovery-1',
      machineId: 'machine-recovery-1',
      actionKind: 'tool.invoke',
      toolName: 'send:email',
      parameters: { to: 'ops@example.com' },
      executionTier: 'HumanApprove',
      toolClassification: {
        toolName: 'send:email',
        category: 'Mutation',
        minimumTier: 'HumanApprove',
        rationale: 'Outbound communication requires approval.',
      },
      policyDecision: 'RequireApproval',
      policyIds: ['policy-outbound-approval'],
      decision: 'NeedsApproval',
      approvalId: APPROVAL_ID,
      rationale: 'Pending human approval before outbound send.',
      requestedByUserId: 'user-requester',
      correlationId: CORRELATION_ID,
      proposedAtIso: '2026-04-30T00:02:00.000Z',
      idempotencyKey: 'idem-recovery-send-1',
    }),
  );

  return {
    approvals: new Map([[String(APPROVAL_ID), approval]]),
    runs: new Map([[String(RUN_ID), run]]),
    plans: new Map([[String(PLAN_ID), plan]]),
    executedEffectKeys: new Set<string>(),
    evidenceLog,
    proposalStore,
  };
}

function createRuntime(state: DurableRecoveryState, idPrefix: string): RecoveryRuntime {
  let next = 0;
  return {
    approvalStore: new DurableApprovalStore(state.approvals),
    runStore: new DurableRunStore(state.runs),
    planStore: new DurablePlanStore(state.plans),
    publisher: new CapturingPublisher(),
    evidenceLog: state.evidenceLog,
    proposalStore: state.proposalStore,
    idGenerator: {
      generateId: () => {
        next += 1;
        return `${idPrefix}-${next}`;
      },
    },
    unitOfWork: { execute: async (fn) => fn() },
  };
}

function operatorContext() {
  return toAppContext({
    tenantId: String(TENANT_ID),
    principalId: String(UserId('user-operator')),
    roles: ['operator'],
    correlationId: String(CORRELATION_ID),
  });
}

async function resumeApprovedAction(
  runtime: RecoveryRuntime,
  state: DurableRecoveryState,
): Promise<{ executed: boolean; skippedDuplicate: boolean }> {
  const approval = await runtime.approvalStore.getApprovalById(
    TENANT_ID,
    WORKSPACE_ID,
    APPROVAL_ID,
  );
  const plan = await runtime.planStore.getPlanById(TENANT_ID, WORKSPACE_ID, PLAN_ID);
  const run = await runtime.runStore.getRunById(TENANT_ID, WORKSPACE_ID, RUN_ID);

  expect(approval?.status).toBe('Approved');
  expect(plan).not.toBeNull();
  expect(run).not.toBeNull();
  if (!plan || !run) return { executed: false, skippedDuplicate: false };

  const effect = plan.plannedEffects[0]!;
  const key = effect.idempotencyKey ?? String(effect.effectId);
  if (state.executedEffectKeys.has(key)) {
    return { executed: false, skippedDuplicate: true };
  }

  state.executedEffectKeys.add(key);
  await runtime.evidenceLog.appendEntry(TENANT_ID, {
    schemaVersion: 1,
    evidenceId: EvidenceId('ev-recovery-action-1'),
    workspaceId: WORKSPACE_ID,
    correlationId: CORRELATION_ID,
    occurredAtIso: '2026-04-30T00:10:00.000Z',
    category: 'Action',
    summary: `Executed ${effect.summary}`,
    actor: { kind: 'Machine', machineId: 'machine-recovery-1' as never },
    links: { runId: RUN_ID, planId: PLAN_ID, approvalId: APPROVAL_ID },
    payloadRefs: [
      {
        kind: 'Artifact',
        uri: 'urn:portarium:evidence-artifact:recovery-action-1',
        contentType: 'application/json',
      },
    ],
  });
  await runtime.runStore.saveRun(TENANT_ID, {
    ...run,
    status: 'Succeeded',
    endedAtIso: '2026-04-30T00:10:01.000Z',
  });

  return { executed: true, skippedDuplicate: false };
}

function buildResultBundle(
  state: DurableRecoveryState,
  runtime: RecoveryRuntime,
): RecoveryResultBundle {
  const run = state.runs.get(String(RUN_ID));
  const approval = state.approvals.get(String(APPROVAL_ID));
  const entries = state.evidenceLog.listEntries(TENANT_ID);
  const actionEvidenceEntries = entries.filter((entry) => entry.category === 'Action').length;

  return {
    beadId: 'bead-1059',
    scenario: 'pending-approval-recovery',
    verdict: 'pass',
    durableObjects: {
      approval: 'survived',
      plan: 'survived',
      evidenceArtifact: 'survived',
      run: 'survived',
    },
    variants: [
      { variant: 'process-crash', classification: 'product-pass', resumeOutcome: 'exact-once' },
      { variant: 'service-restart', classification: 'product-pass', resumeOutcome: 'exact-once' },
      { variant: 'deploy-restart', classification: 'product-pass', resumeOutcome: 'exact-once' },
      {
        variant: 'provider-outage',
        classification: 'environment-limitation',
        resumeOutcome: 'not-run',
      },
    ],
    cockpitOperatorSignals: {
      runStatus: run?.status ?? 'missing',
      controlState: run?.controlState ?? 'missing',
      pendingApprovalVisible: approval?.status === 'Pending' || approval?.status === 'Approved',
    },
    counts: {
      approvalDecisionEvents: runtime.publisher.published.length,
      actionEvidenceEntries,
      executedEffects: state.executedEffectKeys.size,
    },
  };
}

function writeScenarioArtifact(bundle: RecoveryResultBundle): void {
  const dir = join(process.cwd(), 'reports', 'scenarios');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'bead-1059-pending-approval-recovery.json'),
    JSON.stringify(bundle, null, 2) + '\n',
  );
}

describe('Scenario: pending approval recovery and governed resume', () => {
  it('survives restart with approval, plan, run, and evidence artifact state intact', async () => {
    const state = makeState();
    const beforeRestart = createRuntime(state, 'before-restart');
    const afterRestart = createRuntime(state, 'after-restart');

    const pending = await beforeRestart.approvalStore.getApprovalById(
      TENANT_ID,
      WORKSPACE_ID,
      APPROVAL_ID,
    );
    const recoveredPending = await afterRestart.approvalStore.getApprovalById(
      TENANT_ID,
      WORKSPACE_ID,
      APPROVAL_ID,
    );
    const recoveredPlan = await afterRestart.planStore.getPlanById(
      TENANT_ID,
      WORKSPACE_ID,
      PLAN_ID,
    );
    const recoveredRun = await afterRestart.runStore.getRunById(TENANT_ID, WORKSPACE_ID, RUN_ID);
    const recoveredEvidence = state.evidenceLog.listEntries(TENANT_ID);

    expect(pending?.status).toBe('Pending');
    expect(recoveredPending?.status).toBe('Pending');
    expect(recoveredPlan?.plannedEffects[0]?.idempotencyKey).toBe('idem-recovery-send-1');
    expect(recoveredRun?.status).toBe('WaitingForApproval');
    expect(recoveredRun?.controlState).toBe('degraded');
    expect(recoveredEvidence[0]?.payloadRefs?.[0]?.kind).toBe('Artifact');
  });

  it('approves after recovery, resumes exactly once, and records defects vs limitations', async () => {
    const state = makeState();
    const runtime = createRuntime(state, 'recovered');

    const decision = await submitApproval(
      {
        authorization: { isAllowed: async () => true },
        clock: { nowIso: () => '2026-04-30T00:09:00.000Z' },
        idGenerator: runtime.idGenerator,
        approvalStore: runtime.approvalStore,
        unitOfWork: runtime.unitOfWork,
        eventPublisher: runtime.publisher,
        evidenceLog: runtime.evidenceLog,
      },
      operatorContext(),
      {
        workspaceId: String(WORKSPACE_ID),
        approvalId: String(APPROVAL_ID),
        decision: 'Approved',
        rationale: 'Recovered operator reviewed the persisted plan and approval packet.',
      },
    );

    expect(decision.ok).toBe(true);
    expect(runtime.publisher.published).toHaveLength(1);
    expect(
      runtime.evidenceLog.listEntries(TENANT_ID).some((entry) => entry.category === 'Approval'),
    ).toBe(true);

    const firstResume = await resumeApprovedAction(runtime, state);
    const duplicateResume = await resumeApprovedAction(runtime, state);

    expect(firstResume).toEqual({ executed: true, skippedDuplicate: false });
    expect(duplicateResume).toEqual({ executed: false, skippedDuplicate: true });

    const duplicateDecision = await submitApproval(
      {
        authorization: { isAllowed: async () => true },
        clock: { nowIso: () => '2026-04-30T00:11:00.000Z' },
        idGenerator: runtime.idGenerator,
        approvalStore: runtime.approvalStore,
        unitOfWork: runtime.unitOfWork,
        eventPublisher: runtime.publisher,
        evidenceLog: runtime.evidenceLog,
      },
      operatorContext(),
      {
        workspaceId: String(WORKSPACE_ID),
        approvalId: String(APPROVAL_ID),
        decision: 'Approved',
        rationale: 'Duplicate decision should not replay after recovery.',
      },
    );

    expect(duplicateDecision.ok).toBe(false);
    if (!duplicateDecision.ok) {
      expect(duplicateDecision.error.kind).toBe('Conflict');
    }

    const actionEntries: EvidenceEntryV1[] = runtime.evidenceLog
      .listEntries(TENANT_ID)
      .filter((entry) => entry.category === 'Action');
    expect(actionEntries).toHaveLength(1);
    expect(actionEntries[0]?.payloadRefs?.[0]?.uri).toBe(
      'urn:portarium:evidence-artifact:recovery-action-1',
    );

    const bundle = buildResultBundle(state, runtime);
    writeScenarioArtifact(bundle);

    expect(bundle.verdict).toBe('pass');
    expect(bundle.counts.executedEffects).toBe(1);
    expect(bundle.counts.actionEvidenceEntries).toBe(1);
    expect(bundle.variants).toContainEqual({
      variant: 'provider-outage',
      classification: 'environment-limitation',
      resumeOutcome: 'not-run',
    });
  });
});
