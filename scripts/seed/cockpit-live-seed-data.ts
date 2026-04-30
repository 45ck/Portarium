import type { EvidenceEntryAppendInput } from '../../src/application/ports/evidence-log.js';
import {
  parseAdapterRegistrationV1,
  type AdapterRegistrationV1,
} from '../../src/domain/adapters/adapter-registration-v1.js';
import { parseApprovalV1, type ApprovalV1 } from '../../src/domain/approvals/approval-v1.js';
import type { EvidenceCategory } from '../../src/domain/evidence/evidence-entry-v1.js';
import {
  parseAgentConfigV1,
  parseMachineRegistrationV1,
  type AgentConfigV1,
  type MachineRegistrationV1,
} from '../../src/domain/machines/machine-registration-v1.js';
import { parsePlanV1, type PlanV1 } from '../../src/domain/plan/plan-v1.js';
import { parsePolicyV1, type PolicyV1 } from '../../src/domain/policy/policy-v1.js';
import {
  ApprovalId,
  CorrelationId,
  EvidenceId,
  MachineId,
  PlanId,
  RunId,
  TenantId,
  UserId,
  WorkItemId,
  WorkspaceId,
  type TenantId as TenantIdType,
  type WorkspaceId as WorkspaceIdType,
} from '../../src/domain/primitives/index.js';
import { parseRunV1, type RunStatus, type RunV1 } from '../../src/domain/runs/run-v1.js';
import {
  parseWorkspaceUserV1,
  type WorkspaceUserV1,
} from '../../src/domain/users/workspace-user-v1.js';
import { parseHumanTaskV1, type HumanTaskV1 } from '../../src/domain/workforce/human-task-v1.js';
import {
  parseWorkforceMemberV1,
  type WorkforceMemberV1,
} from '../../src/domain/workforce/workforce-member-v1.js';
import {
  parseWorkforceQueueV1,
  type WorkforceQueueV1,
} from '../../src/domain/workforce/workforce-queue-v1.js';
import { parseWorkItemV1, type WorkItemV1 } from '../../src/domain/work-items/work-item-v1.js';
import { parseWorkflowV1, type WorkflowV1 } from '../../src/domain/workflows/workflow-v1.js';
import { parseWorkspaceV1, type WorkspaceV1 } from '../../src/domain/workspaces/workspace-v1.js';

export const COCKPIT_LIVE_SEED_DEFAULTS = {
  tenantId: 'ws-local-dev',
  workspaceId: 'ws-local-dev',
  workspaceName: 'Local Dev Cockpit',
  createdAtIso: '2026-04-30T00:00:00.000Z',
} as const;

export const COCKPIT_LIVE_SEED_IDS = {
  users: ['user-local-dev', 'user-operator', 'user-approver', 'user-auditor'],
  policies: ['pol-live-approval', 'pol-live-audit'],
  workflows: ['wf-invoice-remediation', 'wf-iam-review', 'wf-robot-mission'],
  runs: ['run-live-001', 'run-live-002', 'run-live-003', 'run-live-004'],
  plans: ['plan-live-001', 'plan-live-002', 'plan-live-003'],
  approvals: ['apr-live-001', 'apr-live-002'],
  workItems: ['wi-live-001', 'wi-live-002', 'wi-live-003'],
  evidence: ['ev-live-001', 'ev-live-002', 'ev-live-003', 'ev-live-004'],
  adapters: ['adapter-finance-001', 'adapter-iam-001', 'adapter-robotics-001'],
  machines: ['machine-edge-001'],
  agents: ['agent-finance-001', 'agent-iam-001', 'agent-robotics-001'],
  workforceMembers: ['wfm-operator', 'wfm-approver', 'wfm-auditor'],
  workforceQueues: ['queue-ops', 'queue-approvals'],
  humanTasks: ['ht-live-001', 'ht-live-002', 'ht-live-003'],
} as const;

const REQUIRED_RUN_STATUSES = [
  'WaitingForApproval',
  'Running',
  'Succeeded',
  'Failed',
] as const satisfies readonly RunStatus[];

const REQUIRED_EVIDENCE_CATEGORIES = [
  'Plan',
  'Approval',
  'Action',
  'System',
] as const satisfies readonly EvidenceCategory[];

export type CockpitLiveSeedOptions = Readonly<{
  tenantId?: string;
  workspaceId?: string;
}>;

export type CockpitLiveSeedBundle = Readonly<{
  tenantId: TenantIdType;
  workspaceId: WorkspaceIdType;
  workspace: WorkspaceV1;
  users: readonly WorkspaceUserV1[];
  policies: readonly PolicyV1[];
  workflows: readonly WorkflowV1[];
  adapters: readonly AdapterRegistrationV1[];
  machines: readonly MachineRegistrationV1[];
  agents: readonly AgentConfigV1[];
  runs: readonly RunV1[];
  plans: readonly PlanV1[];
  approvals: readonly ApprovalV1[];
  workItems: readonly WorkItemV1[];
  evidence: readonly EvidenceEntryAppendInput[];
  workforceMembers: readonly WorkforceMemberV1[];
  workforceQueues: readonly WorkforceQueueV1[];
  humanTasks: readonly HumanTaskV1[];
}>;

export type CockpitLiveSeedSummary = Readonly<{
  tenantId: string;
  workspaceId: string;
  counts: Readonly<Record<keyof Omit<CockpitLiveSeedBundle, 'tenantId' | 'workspaceId'>, number>>;
  keyIds: Readonly<{
    pendingApprovalId: string;
    writableRunId: string;
    primaryWorkItemId: string;
  }>;
  coverage: Readonly<{
    runStatuses: readonly RunStatus[];
    evidenceCategories: readonly EvidenceCategory[];
  }>;
}>;

export function createCockpitLiveSeedBundle(
  options: CockpitLiveSeedOptions = {},
): CockpitLiveSeedBundle {
  const tenantIdRaw = nonEmpty(options.tenantId) ?? COCKPIT_LIVE_SEED_DEFAULTS.tenantId;
  const workspaceIdRaw = nonEmpty(options.workspaceId) ?? COCKPIT_LIVE_SEED_DEFAULTS.workspaceId;
  const tenantId = TenantId(tenantIdRaw);
  const workspaceId = WorkspaceId(workspaceIdRaw);

  const workspace = parseWorkspaceV1({
    workspaceId: workspaceIdRaw,
    tenantId: tenantIdRaw,
    name: COCKPIT_LIVE_SEED_DEFAULTS.workspaceName,
    createdAtIso: COCKPIT_LIVE_SEED_DEFAULTS.createdAtIso,
    userIds: COCKPIT_LIVE_SEED_IDS.users,
    projectIds: ['project-live-ops'],
    credentialGrantIds: ['cg-live-machine'],
  });

  const users = [
    parseWorkspaceUserV1({
      userId: 'user-local-dev',
      workspaceId: workspaceIdRaw,
      email: 'local.dev@portarium.example',
      displayName: 'Local Dev Admin',
      roles: ['admin', 'operator', 'approver', 'auditor'],
      active: true,
      createdAtIso: '2026-04-30T00:01:00.000Z',
    }),
    parseWorkspaceUserV1({
      userId: 'user-operator',
      workspaceId: workspaceIdRaw,
      email: 'operator@portarium.example',
      displayName: 'Operations Operator',
      roles: ['operator'],
      active: true,
      createdAtIso: '2026-04-30T00:01:10.000Z',
    }),
    parseWorkspaceUserV1({
      userId: 'user-approver',
      workspaceId: workspaceIdRaw,
      email: 'approver@portarium.example',
      displayName: 'Governance Approver',
      roles: ['approver'],
      active: true,
      createdAtIso: '2026-04-30T00:01:20.000Z',
    }),
    parseWorkspaceUserV1({
      userId: 'user-auditor',
      workspaceId: workspaceIdRaw,
      email: 'auditor@portarium.example',
      displayName: 'Evidence Auditor',
      roles: ['auditor'],
      active: true,
      createdAtIso: '2026-04-30T00:01:30.000Z',
    }),
  ];

  const policies = [
    parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-live-approval',
      workspaceId: workspaceIdRaw,
      name: 'Local human approval gate',
      description: 'Requires human review for seeded HumanApprove runs.',
      active: true,
      priority: 1,
      version: 1,
      createdAtIso: '2026-04-30T00:02:00.000Z',
      createdByUserId: 'user-local-dev',
      sodConstraints: [
        { kind: 'MakerChecker' },
        { kind: 'DistinctApprovers', minimumApprovers: 1 },
        {
          kind: 'SpecialistApproval',
          requiredRoles: ['approver'],
          rationale: 'Seeded approval queue must be decided by an approver.',
        },
      ],
      rules: [
        {
          ruleId: 'rule-live-approval-001',
          condition: 'run.executionTier == "HumanApprove"',
          effect: 'Allow',
        },
      ],
    }),
    parsePolicyV1({
      schemaVersion: 1,
      policyId: 'pol-live-audit',
      workspaceId: workspaceIdRaw,
      name: 'Local evidence retention',
      description: 'Keeps seeded live evidence visible for Cockpit QA.',
      active: true,
      priority: 2,
      version: 1,
      createdAtIso: '2026-04-30T00:02:10.000Z',
      createdByUserId: 'user-local-dev',
      rules: [
        {
          ruleId: 'rule-live-audit-001',
          condition: 'evidence.category in ["Plan", "Approval", "Action", "System"]',
          effect: 'Allow',
        },
      ],
    }),
  ];

  const workflows = [
    parseWorkflowV1({
      schemaVersion: 2,
      workflowId: 'wf-invoice-remediation',
      workspaceId: workspaceIdRaw,
      name: 'Invoice remediation with approval',
      description: 'Reads a disputed invoice, prepares a write, and waits for approval.',
      version: 1,
      active: true,
      executionTier: 'HumanApprove',
      actions: [
        {
          actionId: 'act-invoice-read',
          order: 1,
          portFamily: 'FinanceAccounting',
          capability: 'invoice:read',
          operation: 'invoice:read',
        },
        {
          actionId: 'act-invoice-write',
          order: 2,
          portFamily: 'FinanceAccounting',
          capability: 'invoice:write',
          operation: 'invoice:write',
        },
      ],
    }),
    parseWorkflowV1({
      schemaVersion: 2,
      workflowId: 'wf-iam-review',
      workspaceId: workspaceIdRaw,
      name: 'Dormant identity access review',
      description: 'Reviews directory users and stages a governed group update.',
      version: 1,
      active: true,
      executionTier: 'HumanApprove',
      actions: [
        {
          actionId: 'act-iam-user-read',
          order: 1,
          portFamily: 'IamDirectory',
          capability: 'user:read',
          operation: 'user:read',
        },
        {
          actionId: 'act-iam-group-write',
          order: 2,
          portFamily: 'IamDirectory',
          capability: 'group:write',
          operation: 'group:write',
        },
      ],
    }),
    parseWorkflowV1({
      schemaVersion: 2,
      workflowId: 'wf-robot-mission',
      workspaceId: workspaceIdRaw,
      name: 'Robot mission supervision gate',
      description: 'Seeded robotics governance data; live telemetry remains separately gated.',
      version: 1,
      active: true,
      executionTier: 'ManualOnly',
      actions: [
        {
          actionId: 'act-robot-state',
          order: 1,
          portFamily: 'RoboticsActuation',
          capability: 'robot:get_state',
          operation: 'robot:get_state',
        },
        {
          actionId: 'act-robot-execute',
          order: 2,
          portFamily: 'RoboticsActuation',
          capability: 'robot:execute_action',
          operation: 'robot:execute_action',
        },
      ],
    }),
  ];

  const adapters = [
    parseAdapterRegistrationV1({
      schemaVersion: 2,
      adapterId: 'adapter-finance-001',
      workspaceId: workspaceIdRaw,
      providerSlug: 'local-finance',
      portFamily: 'FinanceAccounting',
      enabled: true,
      capabilityMatrix: [
        { capability: 'invoice:read', operation: 'invoice:read', requiresAuth: true },
        { capability: 'invoice:write', operation: 'invoice:write', requiresAuth: true },
      ],
      executionPolicy: liveExecutionPolicy('https://finance.local.invalid'),
      machineRegistrations: [
        {
          machineId: 'machine-edge-001',
          endpointUrl: 'https://machine.local.invalid/v1',
          active: true,
          displayName: 'Local edge gateway',
          authHint: 'bearer',
        },
      ],
    }),
    parseAdapterRegistrationV1({
      schemaVersion: 2,
      adapterId: 'adapter-iam-001',
      workspaceId: workspaceIdRaw,
      providerSlug: 'local-iam',
      portFamily: 'IamDirectory',
      enabled: true,
      capabilityMatrix: [
        { capability: 'user:read', operation: 'user:read', requiresAuth: true },
        { capability: 'group:write', operation: 'group:write', requiresAuth: true },
      ],
      executionPolicy: liveExecutionPolicy('https://iam.local.invalid'),
      machineRegistrations: [
        {
          machineId: 'machine-edge-001',
          endpointUrl: 'https://machine.local.invalid/v1',
          active: true,
          displayName: 'Local edge gateway',
          authHint: 'bearer',
        },
      ],
    }),
    parseAdapterRegistrationV1({
      schemaVersion: 2,
      adapterId: 'adapter-robotics-001',
      workspaceId: workspaceIdRaw,
      providerSlug: 'local-robotics-gated',
      portFamily: 'RoboticsActuation',
      enabled: false,
      capabilityMatrix: [
        { capability: 'robot:get_state', operation: 'robot:get_state', requiresAuth: true },
        {
          capability: 'robot:execute_action',
          operation: 'robot:execute_action',
          requiresAuth: true,
        },
      ],
      executionPolicy: liveExecutionPolicy('https://robotics.local.invalid'),
      machineRegistrations: [
        {
          machineId: 'machine-edge-001',
          endpointUrl: 'https://machine.local.invalid/v1',
          active: true,
          displayName: 'Local edge gateway',
          authHint: 'bearer',
        },
      ],
    }),
  ];

  const machines = [
    parseMachineRegistrationV1({
      schemaVersion: 1,
      machineId: 'machine-edge-001',
      workspaceId: workspaceIdRaw,
      endpointUrl: 'https://machine.local.invalid/v1',
      active: true,
      displayName: 'Local edge gateway',
      capabilities: [
        'invoice:read',
        'invoice:write',
        'user:read',
        'group:write',
        'robot:get_state',
        'robot:execute_action',
      ],
      registeredAtIso: '2026-04-30T00:03:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: [
          'https://finance.local.invalid',
          'https://iam.local.invalid',
          'https://robotics.local.invalid',
        ],
        workloadIdentity: 'Required',
      },
      authConfig: { kind: 'bearer', secretRef: 'grants/cg-live-machine' },
    }),
  ];

  const agents = [
    parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-finance-001',
      workspaceId: workspaceIdRaw,
      machineId: 'machine-edge-001',
      displayName: 'Finance remediation agent',
      capabilities: ['invoice:read', 'invoice:write'],
      policyTier: 'HumanApprove',
      allowedTools: ['invoice:read', 'invoice:write'],
      registeredAtIso: '2026-04-30T00:03:20.000Z',
    }),
    parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-iam-001',
      workspaceId: workspaceIdRaw,
      machineId: 'machine-edge-001',
      displayName: 'Identity review agent',
      capabilities: ['user:read', 'group:write'],
      policyTier: 'HumanApprove',
      allowedTools: ['user:read', 'group:write'],
      registeredAtIso: '2026-04-30T00:03:30.000Z',
    }),
    parseAgentConfigV1({
      schemaVersion: 1,
      agentId: 'agent-robotics-001',
      workspaceId: workspaceIdRaw,
      machineId: 'machine-edge-001',
      displayName: 'Robotics gated agent',
      capabilities: ['robot:get_state', 'robot:execute_action'],
      policyTier: 'ManualOnly',
      allowedTools: ['robot:get_state', 'robot:execute_action'],
      registeredAtIso: '2026-04-30T00:03:40.000Z',
    }),
  ];

  const runs = [
    parseRunV1({
      schemaVersion: 1,
      runId: 'run-live-001',
      workspaceId: workspaceIdRaw,
      workflowId: 'wf-invoice-remediation',
      correlationId: 'corr-live-001',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-operator',
      status: 'WaitingForApproval',
      createdAtIso: '2026-04-30T00:10:00.000Z',
      startedAtIso: '2026-04-30T00:10:05.000Z',
      controlState: 'waiting',
      operatorOwnerId: 'user-operator',
    }),
    parseRunV1({
      schemaVersion: 1,
      runId: 'run-live-002',
      workspaceId: workspaceIdRaw,
      workflowId: 'wf-iam-review',
      correlationId: 'corr-live-002',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-operator',
      status: 'Running',
      createdAtIso: '2026-04-30T00:12:00.000Z',
      startedAtIso: '2026-04-30T00:12:04.000Z',
      controlState: 'degraded',
      operatorOwnerId: 'user-operator',
    }),
    parseRunV1({
      schemaVersion: 1,
      runId: 'run-live-003',
      workspaceId: workspaceIdRaw,
      workflowId: 'wf-invoice-remediation',
      correlationId: 'corr-live-003',
      executionTier: 'HumanApprove',
      initiatedByUserId: 'user-local-dev',
      status: 'Succeeded',
      createdAtIso: '2026-04-30T00:14:00.000Z',
      startedAtIso: '2026-04-30T00:14:03.000Z',
      endedAtIso: '2026-04-30T00:16:20.000Z',
    }),
    parseRunV1({
      schemaVersion: 1,
      runId: 'run-live-004',
      workspaceId: workspaceIdRaw,
      workflowId: 'wf-robot-mission',
      correlationId: 'corr-live-004',
      executionTier: 'ManualOnly',
      initiatedByUserId: 'user-local-dev',
      status: 'Failed',
      createdAtIso: '2026-04-30T00:18:00.000Z',
      startedAtIso: '2026-04-30T00:18:03.000Z',
      endedAtIso: '2026-04-30T00:18:40.000Z',
      controlState: 'blocked',
    }),
  ];

  const plans = [
    parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-live-001',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:10:10.000Z',
      createdByUserId: 'user-operator',
      plannedEffects: [
        {
          effectId: 'effect-live-001',
          operation: 'Update',
          target: invoiceRef('INV-2026-0042', 'Disputed vendor invoice INV-2026-0042'),
          summary: 'Mark invoice as disputed and hold payment until review.',
          idempotencyKey: 'plan-live-001:effect-live-001',
        },
      ],
      predictedEffects: [
        {
          effectId: 'effect-live-001',
          operation: 'Update',
          target: invoiceRef('INV-2026-0042', 'Disputed vendor invoice INV-2026-0042'),
          summary: 'Mark invoice as disputed and hold payment until review.',
          idempotencyKey: 'plan-live-001:effect-live-001',
          confidence: 0.91,
        },
      ],
    }),
    parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-live-002',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:12:15.000Z',
      createdByUserId: 'user-operator',
      plannedEffects: [
        {
          effectId: 'effect-live-002',
          operation: 'Update',
          target: iamRef('group-finance-admins', 'Finance Admins'),
          summary: 'Remove dormant users from the Finance Admins group.',
          idempotencyKey: 'plan-live-002:effect-live-002',
        },
      ],
    }),
    parsePlanV1({
      schemaVersion: 1,
      planId: 'plan-live-003',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:14:20.000Z',
      createdByUserId: 'user-local-dev',
      plannedEffects: [
        {
          effectId: 'effect-live-003',
          operation: 'Update',
          target: invoiceRef('INV-2026-0037', 'Vendor invoice INV-2026-0037'),
          summary: 'Release a previously approved invoice hold.',
          idempotencyKey: 'plan-live-003:effect-live-003',
        },
      ],
    }),
  ];

  const approvals = [
    parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'apr-live-001',
      workspaceId: workspaceIdRaw,
      runId: 'run-live-001',
      planId: 'plan-live-001',
      workItemId: 'wi-live-001',
      prompt: 'Approve the invoice hold for INV-2026-0042 before the write action executes.',
      requestedAtIso: '2026-04-30T00:10:30.000Z',
      requestedByUserId: 'user-operator',
      assigneeUserId: 'user-approver',
      dueAtIso: '2026-04-30T04:10:30.000Z',
      escalationChain: [{ stepOrder: 1, escalateToUserId: 'user-local-dev', afterHours: 4 }],
      status: 'Pending',
    }),
    parseApprovalV1({
      schemaVersion: 1,
      approvalId: 'apr-live-002',
      workspaceId: workspaceIdRaw,
      runId: 'run-live-003',
      planId: 'plan-live-003',
      workItemId: 'wi-live-003',
      prompt: 'Approve release of the invoice hold after reconciliation evidence is attached.',
      requestedAtIso: '2026-04-30T00:14:35.000Z',
      requestedByUserId: 'user-local-dev',
      assigneeUserId: 'user-approver',
      status: 'Approved',
      decidedAtIso: '2026-04-30T00:15:50.000Z',
      decidedByUserId: 'user-approver',
      rationale: 'Evidence and maker-checker checks passed.',
    }),
  ];

  const workItems = [
    parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-live-001',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:10:20.000Z',
      createdByUserId: 'user-operator',
      title: 'Approve invoice hold before finance write',
      status: 'Open',
      ownerUserId: 'user-approver',
      sla: { dueAtIso: '2026-04-30T04:10:20.000Z' },
      links: {
        externalRefs: [invoiceRef('INV-2026-0042', 'Disputed vendor invoice INV-2026-0042')],
        runIds: ['run-live-001'],
        workflowIds: ['wf-invoice-remediation'],
        approvalIds: ['apr-live-001'],
        evidenceIds: ['ev-live-001', 'ev-live-002'],
      },
    }),
    parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-live-002',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:12:20.000Z',
      createdByUserId: 'user-operator',
      title: 'Review dormant identity group update',
      status: 'InProgress',
      ownerUserId: 'user-operator',
      sla: { dueAtIso: '2026-05-01T00:12:20.000Z' },
      links: {
        externalRefs: [iamRef('group-finance-admins', 'Finance Admins')],
        runIds: ['run-live-002'],
        workflowIds: ['wf-iam-review'],
      },
    }),
    parseWorkItemV1({
      schemaVersion: 1,
      workItemId: 'wi-live-003',
      workspaceId: workspaceIdRaw,
      createdAtIso: '2026-04-30T00:14:30.000Z',
      createdByUserId: 'user-local-dev',
      title: 'Archive approved invoice release evidence',
      status: 'Resolved',
      ownerUserId: 'user-auditor',
      links: {
        externalRefs: [invoiceRef('INV-2026-0037', 'Vendor invoice INV-2026-0037')],
        runIds: ['run-live-003'],
        workflowIds: ['wf-invoice-remediation'],
        approvalIds: ['apr-live-002'],
        evidenceIds: ['ev-live-003'],
      },
    }),
  ];

  const evidence = [
    {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-live-001'),
      workspaceId,
      correlationId: CorrelationId('corr-live-001'),
      occurredAtIso: '2026-04-30T00:10:12.000Z',
      category: 'Plan',
      summary: 'Plan created for invoice hold remediation.',
      actor: { kind: 'User', userId: UserId('user-operator') },
      links: {
        runId: RunId('run-live-001'),
        planId: PlanId('plan-live-001'),
        workItemId: WorkItemId('wi-live-001'),
        externalRefs: [invoiceRef('INV-2026-0042', 'Disputed vendor invoice INV-2026-0042')],
      },
      payloadRefs: [
        {
          kind: 'Snapshot',
          uri: 'evidence://ws-local-dev/plans/plan-live-001.json',
          contentType: 'application/json',
        },
      ],
    },
    {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-live-002'),
      workspaceId,
      correlationId: CorrelationId('corr-live-001'),
      occurredAtIso: '2026-04-30T00:10:31.000Z',
      category: 'Approval',
      summary: 'Approval requested for the invoice write action.',
      actor: { kind: 'System' },
      links: {
        runId: RunId('run-live-001'),
        planId: PlanId('plan-live-001'),
        workItemId: WorkItemId('wi-live-001'),
        approvalId: ApprovalId('apr-live-001'),
      },
      payloadRefs: [
        {
          kind: 'Log',
          uri: 'evidence://ws-local-dev/approvals/apr-live-001-requested.json',
          contentType: 'application/json',
        },
      ],
    },
    {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-live-003'),
      workspaceId,
      correlationId: CorrelationId('corr-live-003'),
      occurredAtIso: '2026-04-30T00:16:22.000Z',
      category: 'Action',
      summary: 'Approved invoice release action completed.',
      actor: { kind: 'Machine', machineId: MachineId('machine-edge-001') },
      links: {
        runId: RunId('run-live-003'),
        planId: PlanId('plan-live-003'),
        workItemId: WorkItemId('wi-live-003'),
        approvalId: ApprovalId('apr-live-002'),
      },
      payloadRefs: [
        {
          kind: 'Diff',
          uri: 'evidence://ws-local-dev/runs/run-live-003/effects.json',
          contentType: 'application/json',
        },
      ],
    },
    {
      schemaVersion: 1,
      evidenceId: EvidenceId('ev-live-004'),
      workspaceId,
      correlationId: CorrelationId('corr-live-004'),
      occurredAtIso: '2026-04-30T00:18:42.000Z',
      category: 'System',
      summary: 'Robotics workflow remains gated without live telemetry.',
      actor: { kind: 'System' },
      links: {
        runId: RunId('run-live-004'),
      },
      payloadRefs: [
        {
          kind: 'Log',
          uri: 'evidence://ws-local-dev/runs/run-live-004/gated-robotics.json',
          contentType: 'application/json',
        },
      ],
    },
  ] satisfies readonly EvidenceEntryAppendInput[];

  const workforceMembers = [
    parseWorkforceMemberV1({
      schemaVersion: 1,
      workforceMemberId: 'wfm-operator',
      linkedUserId: 'user-operator',
      displayName: 'Operations operator',
      capabilities: ['operations.dispatch'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-ops'],
      tenantId: tenantIdRaw,
      createdAtIso: '2026-04-30T00:04:00.000Z',
      updatedAtIso: '2026-04-30T00:05:00.000Z',
    }),
    parseWorkforceMemberV1({
      schemaVersion: 1,
      workforceMemberId: 'wfm-approver',
      linkedUserId: 'user-approver',
      displayName: 'Governance approver',
      capabilities: ['operations.approval', 'operations.escalation'],
      availabilityStatus: 'busy',
      queueMemberships: ['queue-approvals'],
      tenantId: tenantIdRaw,
      createdAtIso: '2026-04-30T00:04:10.000Z',
      updatedAtIso: '2026-04-30T00:05:10.000Z',
    }),
    parseWorkforceMemberV1({
      schemaVersion: 1,
      workforceMemberId: 'wfm-auditor',
      linkedUserId: 'user-auditor',
      displayName: 'Evidence auditor',
      capabilities: ['operations.escalation'],
      availabilityStatus: 'available',
      queueMemberships: ['queue-approvals'],
      tenantId: tenantIdRaw,
      createdAtIso: '2026-04-30T00:04:20.000Z',
      updatedAtIso: '2026-04-30T00:05:20.000Z',
    }),
  ];

  const workforceQueues = [
    parseWorkforceQueueV1({
      schemaVersion: 1,
      workforceQueueId: 'queue-ops',
      name: 'Operations dispatch',
      requiredCapabilities: ['operations.dispatch'],
      memberIds: ['wfm-operator'],
      routingStrategy: 'round-robin',
      tenantId: tenantIdRaw,
    }),
    parseWorkforceQueueV1({
      schemaVersion: 1,
      workforceQueueId: 'queue-approvals',
      name: 'Approval escalation',
      requiredCapabilities: ['operations.approval', 'operations.escalation'],
      memberIds: ['wfm-approver', 'wfm-auditor'],
      routingStrategy: 'least-busy',
      tenantId: tenantIdRaw,
    }),
  ];

  const humanTasks = [
    parseHumanTaskV1({
      schemaVersion: 1,
      humanTaskId: 'ht-live-001',
      workItemId: 'wi-live-001',
      runId: 'run-live-001',
      stepId: 'act-invoice-write',
      assigneeId: 'wfm-approver',
      groupId: 'queue-approvals',
      description: 'Review and decide the pending invoice write approval.',
      requiredCapabilities: ['operations.approval'],
      status: 'assigned',
      dueAt: '2026-04-30T04:10:30.000Z',
    }),
    parseHumanTaskV1({
      schemaVersion: 1,
      humanTaskId: 'ht-live-002',
      workItemId: 'wi-live-002',
      runId: 'run-live-002',
      stepId: 'act-iam-group-write',
      groupId: 'queue-ops',
      description: 'Monitor the IAM review while it stages group changes.',
      requiredCapabilities: ['operations.dispatch'],
      status: 'pending',
      dueAt: '2026-05-01T00:12:20.000Z',
    }),
    parseHumanTaskV1({
      schemaVersion: 1,
      humanTaskId: 'ht-live-003',
      workItemId: 'wi-live-003',
      runId: 'run-live-003',
      stepId: 'act-invoice-write',
      assigneeId: 'wfm-auditor',
      groupId: 'queue-approvals',
      description: 'Archive completed invoice release evidence.',
      requiredCapabilities: ['operations.escalation'],
      status: 'completed',
      dueAt: '2026-04-30T02:14:30.000Z',
      completedAt: '2026-04-30T00:17:30.000Z',
      completedById: 'wfm-auditor',
      evidenceAnchorId: 'ev-live-003',
    }),
  ];

  const bundle = {
    tenantId,
    workspaceId,
    workspace,
    users,
    policies,
    workflows,
    adapters,
    machines,
    agents,
    runs,
    plans,
    approvals,
    workItems,
    evidence,
    workforceMembers,
    workforceQueues,
    humanTasks,
  } satisfies CockpitLiveSeedBundle;

  assertValidCockpitLiveSeedBundle(bundle);
  return bundle;
}

export function validateCockpitLiveSeedBundle(bundle: CockpitLiveSeedBundle): readonly string[] {
  const errors: string[] = [];

  if (String(bundle.workspace.workspaceId) !== String(bundle.workspaceId)) {
    errors.push('workspace.workspaceId must match bundle.workspaceId');
  }
  if (String(bundle.workspace.tenantId) !== String(bundle.tenantId)) {
    errors.push('workspace.tenantId must match bundle.tenantId');
  }

  requireIds(
    'users',
    bundle.users.map((user) => String(user.userId)),
    COCKPIT_LIVE_SEED_IDS.users,
    errors,
  );
  requireIds(
    'policies',
    bundle.policies.map((policy) => String(policy.policyId)),
    COCKPIT_LIVE_SEED_IDS.policies,
    errors,
  );
  requireIds(
    'workflows',
    bundle.workflows.map((workflow) => String(workflow.workflowId)),
    COCKPIT_LIVE_SEED_IDS.workflows,
    errors,
  );
  requireIds(
    'runs',
    bundle.runs.map((run) => String(run.runId)),
    COCKPIT_LIVE_SEED_IDS.runs,
    errors,
  );
  requireIds(
    'plans',
    bundle.plans.map((plan) => String(plan.planId)),
    COCKPIT_LIVE_SEED_IDS.plans,
    errors,
  );
  requireIds(
    'approvals',
    bundle.approvals.map((approval) => String(approval.approvalId)),
    COCKPIT_LIVE_SEED_IDS.approvals,
    errors,
  );
  requireIds(
    'work items',
    bundle.workItems.map((workItem) => String(workItem.workItemId)),
    COCKPIT_LIVE_SEED_IDS.workItems,
    errors,
  );
  requireIds(
    'evidence',
    bundle.evidence.map((entry) => String(entry.evidenceId)),
    COCKPIT_LIVE_SEED_IDS.evidence,
    errors,
  );
  requireIds(
    'adapters',
    bundle.adapters.map((adapter) => String(adapter.adapterId)),
    COCKPIT_LIVE_SEED_IDS.adapters,
    errors,
  );
  requireIds(
    'machines',
    bundle.machines.map((machine) => String(machine.machineId)),
    COCKPIT_LIVE_SEED_IDS.machines,
    errors,
  );
  requireIds(
    'agents',
    bundle.agents.map((agent) => String(agent.agentId)),
    COCKPIT_LIVE_SEED_IDS.agents,
    errors,
  );
  requireIds(
    'workforce members',
    bundle.workforceMembers.map((member) => String(member.workforceMemberId)),
    COCKPIT_LIVE_SEED_IDS.workforceMembers,
    errors,
  );
  requireIds(
    'workforce queues',
    bundle.workforceQueues.map((queue) => String(queue.workforceQueueId)),
    COCKPIT_LIVE_SEED_IDS.workforceQueues,
    errors,
  );
  requireIds(
    'human tasks',
    bundle.humanTasks.map((task) => String(task.humanTaskId)),
    COCKPIT_LIVE_SEED_IDS.humanTasks,
    errors,
  );

  const runStatuses = new Set(bundle.runs.map((run) => run.status));
  for (const status of REQUIRED_RUN_STATUSES) {
    if (!runStatuses.has(status)) {
      errors.push(`runs must include status ${status}`);
    }
  }

  const evidenceCategories = new Set(bundle.evidence.map((entry) => entry.category));
  for (const category of REQUIRED_EVIDENCE_CATEGORIES) {
    if (!evidenceCategories.has(category)) {
      errors.push(`evidence must include category ${category}`);
    }
  }

  const pendingApproval = bundle.approvals.find(
    (approval) => String(approval.approvalId) === 'apr-live-001',
  );
  if (pendingApproval?.status !== 'Pending') {
    errors.push('apr-live-001 must be Pending for Cockpit write smoke');
  }
  if (pendingApproval && String(pendingApproval.runId) === String(pendingApproval.planId)) {
    errors.push('apr-live-001 runId and planId must remain distinct for approval submit flow');
  }

  return errors;
}

export function assertValidCockpitLiveSeedBundle(bundle: CockpitLiveSeedBundle): void {
  const errors = validateCockpitLiveSeedBundle(bundle);
  if (errors.length > 0) {
    throw new Error(`Cockpit live seed bundle is invalid: ${errors.join('; ')}`);
  }
}

export function createCockpitLiveSeedSummary(
  bundle: CockpitLiveSeedBundle,
): CockpitLiveSeedSummary {
  return {
    tenantId: String(bundle.tenantId),
    workspaceId: String(bundle.workspaceId),
    counts: {
      workspace: 1,
      users: bundle.users.length,
      policies: bundle.policies.length,
      workflows: bundle.workflows.length,
      adapters: bundle.adapters.length,
      machines: bundle.machines.length,
      agents: bundle.agents.length,
      runs: bundle.runs.length,
      plans: bundle.plans.length,
      approvals: bundle.approvals.length,
      workItems: bundle.workItems.length,
      evidence: bundle.evidence.length,
      workforceMembers: bundle.workforceMembers.length,
      workforceQueues: bundle.workforceQueues.length,
      humanTasks: bundle.humanTasks.length,
    },
    keyIds: {
      pendingApprovalId: 'apr-live-001',
      writableRunId: 'run-live-001',
      primaryWorkItemId: 'wi-live-001',
    },
    coverage: {
      runStatuses: REQUIRED_RUN_STATUSES,
      evidenceCategories: REQUIRED_EVIDENCE_CATEGORIES,
    },
  };
}

function liveExecutionPolicy(egressUrl: string): AdapterRegistrationV1['executionPolicy'] {
  return {
    tenantIsolationMode: 'PerTenantWorker',
    egressAllowlist: [egressUrl],
    credentialScope: 'capabilityMatrix',
    sandboxVerified: true,
    sandboxAvailable: false,
  };
}

function invoiceRef(externalId: string, displayLabel: string) {
  return {
    sorName: 'local-finance',
    portFamily: 'FinanceAccounting' as const,
    externalId,
    externalType: 'Invoice',
    displayLabel,
    deepLinkUrl: `https://finance.local.invalid/invoices/${externalId}`,
  };
}

function iamRef(externalId: string, displayLabel: string) {
  return {
    sorName: 'local-iam',
    portFamily: 'IamDirectory' as const,
    externalId,
    externalType: 'Group',
    displayLabel,
    deepLinkUrl: `https://iam.local.invalid/groups/${externalId}`,
  };
}

function requireIds(
  label: string,
  actualIds: readonly string[],
  requiredIds: readonly string[],
  errors: string[],
): void {
  const actual = new Set(actualIds);
  for (const requiredId of requiredIds) {
    if (!actual.has(requiredId)) {
      errors.push(`${label} missing ${requiredId}`);
    }
  }
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}
