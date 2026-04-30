import { describe, expect, it } from 'vitest';
import { buildAgentObservabilityModel, summarizeEvidenceChain } from './agent-observability';
import type {
  AgentV1,
  ApprovalSummary,
  EvidenceEntry,
  HumanTaskSummary,
  MachineV1,
  RunSummary,
  WorkforceQueueSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';

const AGENT: AgentV1 = {
  schemaVersion: 1,
  agentId: 'agent-1',
  workspaceId: 'ws-1',
  name: 'Ops Agent',
  endpoint: 'machine://machine-1',
  machineId: 'machine-1',
  allowedCapabilities: ['analyze'],
};

const MACHINE: MachineV1 = {
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  hostname: 'runner-1',
  registeredAtIso: '2026-04-30T00:00:00Z',
  status: 'Online',
};

const RUN: RunSummary = {
  schemaVersion: 1,
  runId: 'run-1',
  workspaceId: 'ws-1',
  workflowId: 'workflow-1',
  correlationId: 'corr-1',
  executionTier: 'HumanApprove',
  initiatedByUserId: 'user-1',
  status: 'WaitingForApproval',
  createdAtIso: '2026-04-30T00:01:00Z',
  agentIds: ['agent-1'],
  operatorOwnerId: 'queue-1',
};

const APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'approval-1',
  workspaceId: 'ws-1',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve the tool call',
  status: 'Pending',
  requestedAtIso: '2026-04-30T00:02:00Z',
  requestedByUserId: 'agent-1',
  agentActionProposal: {
    proposalId: 'proposal-1',
    agentId: 'agent-1',
    machineId: 'machine-1',
    toolName: 'crm.update',
    toolCategory: 'Mutation',
    blastRadiusTier: 'HumanApprove',
    rationale: 'Needs account update',
  },
};

const EVIDENCE: EvidenceEntry = {
  schemaVersion: 1,
  evidenceId: 'evidence-1',
  workspaceId: 'ws-1',
  occurredAtIso: '2026-04-30T00:03:00Z',
  category: 'Action',
  summary: 'Tool call proposed',
  actor: { kind: 'Machine', machineId: 'machine-1' },
  links: { runId: 'run-1' },
  hashSha256: 'hash-1',
};

const TASK: HumanTaskSummary = {
  schemaVersion: 1,
  humanTaskId: 'task-1',
  workItemId: 'work-1',
  runId: 'run-1',
  stepId: 'step-1',
  description: 'Review pending approval',
  requiredCapabilities: ['operations.approval'],
  status: 'pending',
};

const WORK_ITEM: WorkItemSummary = {
  schemaVersion: 1,
  workItemId: 'work-1',
  workspaceId: 'ws-1',
  createdAtIso: '2026-04-30T00:00:00Z',
  createdByUserId: 'user-1',
  title: 'Review account update',
  status: 'Open',
  links: { runIds: ['run-1'], approvalIds: ['approval-1'] },
};

const QUEUE: WorkforceQueueSummary = {
  schemaVersion: 1,
  workforceQueueId: 'queue-1',
  name: 'Approvals',
  requiredCapabilities: ['operations.approval'],
  memberIds: ['member-1'],
  routingStrategy: 'manual',
  tenantId: 'tenant-1',
};

function build(overrides: Partial<Parameters<typeof buildAgentObservabilityModel>[0]> = {}) {
  return buildAgentObservabilityModel({
    workspaceId: 'ws-1',
    agents: [AGENT],
    machines: [MACHINE],
    runs: [RUN],
    approvals: [APPROVAL],
    evidence: [EVIDENCE],
    humanTasks: [TASK],
    workItems: [WORK_ITEM],
    queues: [QUEUE],
    ...overrides,
  });
}

describe('agent observability read model', () => {
  it('builds run-scoped agent sessions with approval wait, queue, tool activity, and evidence', () => {
    const model = build();

    expect(model.sessions).toHaveLength(1);
    expect(model.sessions[0]).toMatchObject({
      sessionId: 'ws-1:run-1:agent-1',
      posture: 'waiting',
      toolActivityCount: 1,
      latestToolName: 'crm.update',
      queueNames: ['Approvals'],
    });
    expect(model.sessions[0]?.run?.runId).toBe('run-1');
    expect(model.sessions[0]?.pendingApprovals[0]?.approvalId).toBe('approval-1');
    expect(model.sessions[0]?.latestEvidence?.evidenceId).toBe('evidence-1');
    expect(model.actionableHumanTasks).toHaveLength(1);
    expect(model.openWorkItems).toHaveLength(1);
  });

  it('does not mix evidence or approvals across workspaces', () => {
    const model = build({
      approvals: [
        APPROVAL,
        { ...APPROVAL, approvalId: 'approval-other', workspaceId: 'ws-2', runId: 'run-1' },
      ],
      evidence: [
        EVIDENCE,
        {
          ...EVIDENCE,
          evidenceId: 'evidence-other',
          workspaceId: 'ws-2',
          summary: 'Other workspace evidence',
        },
      ],
    });

    expect(model.sessions[0]?.pendingApprovals.map((approval) => approval.approvalId)).toEqual([
      'approval-1',
    ]);
    expect(model.sessions[0]?.latestEvidence?.summary).toBe('Tool call proposed');
  });

  it('detects broken evidence chain links per run', () => {
    const chain = summarizeEvidenceChain([
      EVIDENCE,
      {
        ...EVIDENCE,
        evidenceId: 'evidence-2',
        occurredAtIso: '2026-04-30T00:04:00Z',
        previousHash: 'not-hash-1',
        hashSha256: 'hash-2',
      },
    ]);

    expect(chain).toEqual({ health: 'gaps', breakCount: 1 });
  });
});
