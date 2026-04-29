import { describe, expect, it } from 'vitest';
import type { ApprovalSummary, RunSummary, WorkItemSummary } from '@portarium/cockpit-types';
import { buildEngineeringBeads } from './engineering-beads';

const baseWorkItem: WorkItemSummary = {
  schemaVersion: 1,
  workItemId: 'bead-1',
  workspaceId: 'ws-demo',
  createdAtIso: '2026-04-01T00:00:00.000Z',
  createdByUserId: 'user-1',
  title: 'Implement approval gate',
  status: 'Open',
};

const baseRun: RunSummary = {
  schemaVersion: 1,
  runId: 'run-1',
  workspaceId: 'ws-demo',
  workflowId: 'wf-1',
  correlationId: 'corr-1',
  executionTier: 'Assisted',
  initiatedByUserId: 'user-1',
  status: 'Running',
  createdAtIso: '2026-04-01T00:01:00.000Z',
};

const baseApproval: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'apr-1',
  workspaceId: 'ws-demo',
  runId: 'run-1',
  planId: 'plan-1',
  workItemId: 'bead-1',
  prompt: 'Approve the proposed change.',
  status: 'Pending',
  requestedAtIso: '2026-04-01T00:02:00.000Z',
  requestedByUserId: 'system',
  policyRule: {
    ruleId: 'POLICY-1',
    trigger: 'write:file',
    tier: 'HumanApprove',
    blastRadius: ['repo'],
    irreversibility: 'partial',
  },
};

describe('buildEngineeringBeads', () => {
  it('maps an orphan open work item to Ready', () => {
    const [bead] = buildEngineeringBeads({
      workItems: [baseWorkItem],
      runs: [],
      approvals: [],
    });

    expect(bead?.column).toBe('Ready');
    expect(bead?.policyTier).toBe('Auto');
  });

  it('maps a running linked run to Running', () => {
    const [bead] = buildEngineeringBeads({
      workItems: [{ ...baseWorkItem, links: { runIds: ['run-1'] } }],
      runs: [baseRun],
      approvals: [],
    });

    expect(bead?.column).toBe('Running');
    expect(bead?.primaryRun?.runId).toBe('run-1');
    expect(bead?.policyTier).toBe('Assisted');
  });

  it('lets a pending approval outrank an active run', () => {
    const [bead] = buildEngineeringBeads({
      workItems: [{ ...baseWorkItem, links: { runIds: ['run-1'] } }],
      runs: [baseRun],
      approvals: [baseApproval],
    });

    expect(bead?.column).toBe('AwaitingApproval');
    expect(bead?.primaryApproval?.approvalId).toBe('apr-1');
    expect(bead?.policyTier).toBe('HumanApprove');
    expect(bead?.blastRadius).toBe('high');
  });

  it('maps closed or terminal work to Done', () => {
    const [bead] = buildEngineeringBeads({
      workItems: [
        { ...baseWorkItem, status: 'Closed', links: { runIds: ['run-1'], evidenceIds: ['ev-1'] } },
      ],
      runs: [{ ...baseRun, status: 'Succeeded', endedAtIso: '2026-04-01T00:03:00.000Z' }],
      approvals: [],
    });

    expect(bead?.column).toBe('Done');
    expect(bead?.evidenceCount).toBe(1);
  });
});
