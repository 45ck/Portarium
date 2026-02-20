import type { EvidenceEntryV1 } from '../evidence/evidence-entry-v1.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import {
  ApprovalId,
  CorrelationId,
  CredentialGrantId,
  EvidenceId,
  PlanId,
  PolicyId,
  ProjectId,
  RunId,
  TenantId,
  UserId,
  WorkItemId,
  WorkflowId,
  WorkspaceId,
} from '../primitives/index.js';
import type { RunV1 } from '../runs/run-v1.js';
import type { WorkItemV1 } from '../work-items/work-item-v1.js';
import type { WorkspaceV1 } from '../workspaces/workspace-v1.js';

export const CANONICAL_SEED_IDS_V1 = {
  tenantId: TenantId('tenant-seed-1'),
  workspaceId: WorkspaceId('ws-seed-1'),
  policyId: PolicyId('pol-seed-1'),
  runId: RunId('run-seed-1'),
  workItemId: WorkItemId('wi-seed-1'),
  evidenceId: EvidenceId('evi-seed-1'),
  planId: PlanId('plan-seed-1'),
  workflowId: WorkflowId('wf-seed-1'),
  correlationId: CorrelationId('corr-seed-1'),
  createdByUserId: UserId('user-seed-1'),
  ownerUserId: UserId('user-seed-2'),
  approvalId: ApprovalId('approval-seed-1'),
} as const;

export type CanonicalEvidenceSeedInputV1 = Omit<
  EvidenceEntryV1,
  'previousHash' | 'hashSha256' | 'signatureBase64'
>;

export type CanonicalSeedBundleV1 = Readonly<{
  workspace: WorkspaceV1;
  policy: PolicyV1;
  run: RunV1;
  evidence: CanonicalEvidenceSeedInputV1;
  workItem: WorkItemV1;
}>;

export type CanonicalSeedBundleOverridesV1 = Readonly<{
  workspace?: Partial<WorkspaceV1>;
  policy?: Partial<PolicyV1>;
  run?: Partial<RunV1>;
  evidence?: Partial<CanonicalEvidenceSeedInputV1>;
  workItem?: Partial<WorkItemV1>;
}>;

export function createCanonicalWorkspaceSeedV1(overrides: Partial<WorkspaceV1> = {}): WorkspaceV1 {
  return {
    workspaceId: CANONICAL_SEED_IDS_V1.workspaceId,
    tenantId: CANONICAL_SEED_IDS_V1.tenantId,
    name: 'Primary Workspace Seed',
    createdAtIso: '2026-02-20T00:00:00.000Z',
    userIds: [CANONICAL_SEED_IDS_V1.createdByUserId, CANONICAL_SEED_IDS_V1.ownerUserId],
    projectIds: [ProjectId('project-seed-1')],
    credentialGrantIds: [CredentialGrantId('cg-seed-1')],
    ...overrides,
  };
}

export function createCanonicalPolicySeedV1(overrides: Partial<PolicyV1> = {}): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: CANONICAL_SEED_IDS_V1.policyId,
    workspaceId: CANONICAL_SEED_IDS_V1.workspaceId,
    name: 'Canonical Seed Policy',
    description: 'Policy seed for repeatable tests.',
    active: true,
    priority: 1,
    version: 1,
    createdAtIso: '2026-02-20T00:01:00.000Z',
    createdByUserId: CANONICAL_SEED_IDS_V1.createdByUserId,
    sodConstraints: [
      { kind: 'MakerChecker' },
      { kind: 'DistinctApprovers', minimumApprovers: 2 },
      { kind: 'IncompatibleDuties', dutyKeys: ['requestor', 'approver'] },
    ],
    rules: [{ ruleId: 'rule-seed-1', condition: 'run.tier == "Auto"', effect: 'Allow' }],
    ...overrides,
  };
}

export function createCanonicalRunSeedV1(overrides: Partial<RunV1> = {}): RunV1 {
  return {
    schemaVersion: 1,
    runId: CANONICAL_SEED_IDS_V1.runId,
    workspaceId: CANONICAL_SEED_IDS_V1.workspaceId,
    workflowId: CANONICAL_SEED_IDS_V1.workflowId,
    correlationId: CANONICAL_SEED_IDS_V1.correlationId,
    executionTier: 'HumanApprove',
    initiatedByUserId: CANONICAL_SEED_IDS_V1.createdByUserId,
    status: 'Running',
    createdAtIso: '2026-02-20T00:02:00.000Z',
    startedAtIso: '2026-02-20T00:02:01.000Z',
    ...overrides,
  };
}

export function createCanonicalEvidenceSeedInputV1(
  overrides: Partial<CanonicalEvidenceSeedInputV1> = {},
): CanonicalEvidenceSeedInputV1 {
  return {
    schemaVersion: 1,
    evidenceId: CANONICAL_SEED_IDS_V1.evidenceId,
    workspaceId: CANONICAL_SEED_IDS_V1.workspaceId,
    correlationId: CANONICAL_SEED_IDS_V1.correlationId,
    occurredAtIso: '2026-02-20T00:02:02.000Z',
    category: 'Action',
    summary: 'Seed evidence entry',
    actor: { kind: 'User', userId: CANONICAL_SEED_IDS_V1.createdByUserId },
    links: {
      runId: CANONICAL_SEED_IDS_V1.runId,
      planId: CANONICAL_SEED_IDS_V1.planId,
      workItemId: CANONICAL_SEED_IDS_V1.workItemId,
      externalRefs: [
        {
          sorName: 'jira',
          portFamily: 'ProjectsWorkMgmt',
          externalId: 'PROJ-SEED-1',
          externalType: 'Issue',
          displayLabel: 'PROJ-SEED-1',
          deepLinkUrl: 'https://jira.example.com/browse/PROJ-SEED-1',
        },
      ],
    },
    payloadRefs: [{ kind: 'Snapshot', uri: 'evidence://snapshots/seed.json' }],
    ...overrides,
  };
}

export function createCanonicalWorkItemSeedV1(overrides: Partial<WorkItemV1> = {}): WorkItemV1 {
  return {
    schemaVersion: 1,
    workItemId: CANONICAL_SEED_IDS_V1.workItemId,
    workspaceId: CANONICAL_SEED_IDS_V1.workspaceId,
    createdAtIso: '2026-02-20T00:01:30.000Z',
    createdByUserId: CANONICAL_SEED_IDS_V1.createdByUserId,
    title: 'Canonical seed work item',
    status: 'Open',
    ownerUserId: CANONICAL_SEED_IDS_V1.ownerUserId,
    sla: { dueAtIso: '2026-02-25T00:00:00.000Z' },
    links: {
      externalRefs: [
        {
          sorName: 'jira',
          portFamily: 'ProjectsWorkMgmt',
          externalId: 'PROJ-SEED-1',
          externalType: 'Issue',
          displayLabel: 'PROJ-SEED-1',
          deepLinkUrl: 'https://jira.example.com/browse/PROJ-SEED-1',
        },
      ],
      runIds: [CANONICAL_SEED_IDS_V1.runId],
      workflowIds: [CANONICAL_SEED_IDS_V1.workflowId],
      approvalIds: [CANONICAL_SEED_IDS_V1.approvalId],
      evidenceIds: [CANONICAL_SEED_IDS_V1.evidenceId],
    },
    ...overrides,
  };
}

export function createCanonicalSeedBundleV1(
  overrides: CanonicalSeedBundleOverridesV1 = {},
): CanonicalSeedBundleV1 {
  return {
    workspace: createCanonicalWorkspaceSeedV1(overrides.workspace),
    policy: createCanonicalPolicySeedV1(overrides.policy),
    run: createCanonicalRunSeedV1(overrides.run),
    evidence: createCanonicalEvidenceSeedInputV1(overrides.evidence),
    workItem: createCanonicalWorkItemSeedV1(overrides.workItem),
  };
}
