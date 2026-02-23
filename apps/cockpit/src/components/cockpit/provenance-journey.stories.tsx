import type { Meta, StoryObj } from '@storybook/react';
import { ProvenanceJourney } from './provenance-journey';
import type { ApprovalSummary, RunSummary, WorkflowSummary } from '@portarium/cockpit-types';

const meta: Meta<typeof ProvenanceJourney> = {
  title: 'Cockpit/ProvenanceJourney',
  component: ProvenanceJourney,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProvenanceJourney>;

const APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-pj-001',
  workspaceId: 'ws-demo',
  runId: 'run-pj-001',
  planId: 'plan-pj-001',
  prompt: 'Approve production deployment of v2.4.1',
  status: 'Pending',
  requestedAtIso: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  requestedByUserId: 'user-alice',
  assigneeUserId: 'user-bob',
};

const RUN: RunSummary = {
  schemaVersion: 1,
  runId: 'run-pj-001',
  workspaceId: 'ws-demo',
  workflowId: 'wf-deploy-001',
  correlationId: 'corr-abc',
  executionTier: 'HumanApprove',
  initiatedByUserId: 'user-alice',
  status: 'WaitingForApproval',
  createdAtIso: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  startedAtIso: new Date(Date.now() - 1000 * 60 * 58).toISOString(),
  agentIds: ['agent-deploy-01', 'agent-monitor-02'],
  robotIds: [],
};

const WORKFLOW: WorkflowSummary = {
  schemaVersion: 1,
  workflowId: 'wf-deploy-001',
  workspaceId: 'ws-demo',
  name: 'Production Deployment Pipeline',
  version: 3,
  active: true,
  executionTier: 'HumanApprove',
  triggerKind: 'Manual',
  actions: [
    { actionId: 'act-1', order: 1, portFamily: 'github', operation: 'CreateDeployment' },
    { actionId: 'act-2', order: 2, portFamily: 'aws', operation: 'UpdateECS' },
    { actionId: 'act-3', order: 3, portFamily: 'datadog', operation: 'CreateMonitor' },
  ],
};

export const MinimalApprovalOnly: Story = {
  args: { approval: APPROVAL },
};

export const WithRun: Story = {
  args: { approval: APPROVAL, run: RUN },
};

export const WithRunAndWorkflow: Story = {
  args: { approval: APPROVAL, run: RUN, workflow: WORKFLOW },
};

export const WithRobots: Story = {
  args: {
    approval: APPROVAL,
    run: { ...RUN, robotIds: ['robot-arm-01', 'robot-sorter-02'], agentIds: [] },
    workflow: WORKFLOW,
  },
};

export const WithDecisionHistory: Story = {
  args: {
    approval: {
      ...APPROVAL,
      decisionHistory: [
        {
          type: 'changes_requested',
          actor: 'user-carol',
          message: 'Please add rollback plan to the PR description.',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          type: 'resubmitted',
          actor: 'user-alice',
          message: 'Added rollback plan. All tests passing.',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        },
      ],
    },
    run: RUN,
    workflow: WORKFLOW,
  },
};

export const CronTriggered: Story = {
  args: {
    approval: APPROVAL,
    run: RUN,
    workflow: { ...WORKFLOW, triggerKind: 'Cron' },
  },
};

export const WebhookTriggered: Story = {
  args: {
    approval: APPROVAL,
    run: RUN,
    workflow: { ...WORKFLOW, triggerKind: 'Webhook' },
  },
};
