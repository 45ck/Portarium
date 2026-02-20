import type { ApprovalPendingV1 } from '../approvals/approval-v1.js';
import type { EvidenceEntryV1 } from '../evidence/evidence-entry-v1.js';
import type { PolicyV1 } from '../policy/policy-v1.js';
import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  PlanId,
  PolicyId,
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
import {
  createCanonicalEvidenceSeedInputV1,
  createCanonicalPolicySeedV1,
  createCanonicalRunSeedV1,
  createCanonicalWorkItemSeedV1,
  createCanonicalWorkspaceSeedV1,
} from './canonical-seeds-v1.js';

export type TenantIsolatedEvidenceSeedInputV1 = Omit<
  EvidenceEntryV1,
  'previousHash' | 'hashSha256' | 'signatureBase64'
>;

export type TenantIsolatedAggregateFixtureContextV1 = Readonly<{
  tenantId: ReturnType<typeof TenantId>;
  workspaceId: ReturnType<typeof WorkspaceId>;
  policyId: ReturnType<typeof PolicyId>;
  runId: ReturnType<typeof RunId>;
  workItemId: ReturnType<typeof WorkItemId>;
  evidenceId: ReturnType<typeof EvidenceId>;
  approvalId: ReturnType<typeof ApprovalId>;
  planId: ReturnType<typeof PlanId>;
  workflowId: ReturnType<typeof WorkflowId>;
  correlationId: ReturnType<typeof CorrelationId>;
  requesterUserId: ReturnType<typeof UserId>;
  ownerUserId: ReturnType<typeof UserId>;
}>;

export type TenantIsolatedAggregateFixtureBundleV1 = Readonly<{
  context: TenantIsolatedAggregateFixtureContextV1;
  workspace: WorkspaceV1;
  policy: PolicyV1;
  run: RunV1;
  workItem: WorkItemV1;
  evidence: TenantIsolatedEvidenceSeedInputV1;
  approval: ApprovalPendingV1;
}>;

export function createTenantIsolatedAggregateFixtureBundleV1(params: {
  tenantSuffix: string;
}): TenantIsolatedAggregateFixtureBundleV1 {
  const context = createContext(params.tenantSuffix);

  const workspace = createCanonicalWorkspaceSeedV1({
    workspaceId: context.workspaceId,
    tenantId: context.tenantId,
    userIds: [context.requesterUserId, context.ownerUserId],
  });

  const policy = createCanonicalPolicySeedV1({
    policyId: context.policyId,
    workspaceId: context.workspaceId,
    createdByUserId: context.requesterUserId,
  });

  const run = createCanonicalRunSeedV1({
    runId: context.runId,
    workspaceId: context.workspaceId,
    workflowId: context.workflowId,
    correlationId: context.correlationId,
    initiatedByUserId: context.requesterUserId,
  });

  const workItem = createCanonicalWorkItemSeedV1({
    workItemId: context.workItemId,
    workspaceId: context.workspaceId,
    createdByUserId: context.requesterUserId,
    ownerUserId: context.ownerUserId,
    links: {
      runIds: [context.runId],
      workflowIds: [context.workflowId],
      approvalIds: [context.approvalId],
      evidenceIds: [context.evidenceId],
    },
  });

  const evidence = createCanonicalEvidenceSeedInputV1({
    evidenceId: context.evidenceId,
    workspaceId: context.workspaceId,
    correlationId: context.correlationId,
    actor: { kind: 'User', userId: context.requesterUserId },
    links: {
      runId: context.runId,
      planId: context.planId,
      workItemId: context.workItemId,
    },
  });

  const approval: ApprovalPendingV1 = {
    schemaVersion: 1,
    approvalId: context.approvalId,
    workspaceId: context.workspaceId,
    runId: context.runId,
    planId: context.planId,
    workItemId: context.workItemId,
    prompt: `Approve run ${context.runId}`,
    requestedAtIso: '2026-02-20T00:02:10.000Z',
    requestedByUserId: context.requesterUserId,
    assigneeUserId: context.ownerUserId,
    status: 'Pending',
  };

  return { context, workspace, policy, run, workItem, evidence, approval };
}

function createContext(rawTenantSuffix: string): TenantIsolatedAggregateFixtureContextV1 {
  const suffix = sanitizeSuffix(rawTenantSuffix);
  return {
    tenantId: TenantId(`tenant-${suffix}`),
    workspaceId: WorkspaceId(`ws-${suffix}`),
    policyId: PolicyId(`policy-${suffix}`),
    runId: RunId(`run-${suffix}`),
    workItemId: WorkItemId(`wi-${suffix}`),
    evidenceId: EvidenceId(`evidence-${suffix}`),
    approvalId: ApprovalId(`approval-${suffix}`),
    planId: PlanId(`plan-${suffix}`),
    workflowId: WorkflowId(`workflow-${suffix}`),
    correlationId: CorrelationId(`corr-${suffix}`),
    requesterUserId: UserId(`requester-${suffix}`),
    ownerUserId: UserId(`owner-${suffix}`),
  };
}

function sanitizeSuffix(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const normalized = trimmed.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'tenant';
}
