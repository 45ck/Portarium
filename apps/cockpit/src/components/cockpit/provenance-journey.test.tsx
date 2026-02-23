// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ApprovalSummary, RunSummary, WorkflowSummary } from '@portarium/cockpit-types';
import { ProvenanceJourney } from './provenance-journey';

const BASE_APPROVAL: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-1',
  workspaceId: 'ws-default',
  runId: 'run-1',
  planId: 'plan-1',
  prompt: 'Approve production deployment',
  status: 'Pending',
  requestedAtIso: '2026-02-21T00:00:00.000Z',
  requestedByUserId: 'user-alice',
};

const BASE_RUN: RunSummary = {
  schemaVersion: 1,
  runId: 'run-1',
  workflowId: 'wf-1',
  workspaceId: 'ws-default',
  correlationId: 'corr-1',
  status: 'WaitingForApproval',
  executionTier: 'HumanApprove',
  initiatedByUserId: 'user-alice',
  createdAtIso: '2026-02-21T00:00:00.000Z',
};

const BASE_WORKFLOW: WorkflowSummary = {
  schemaVersion: 1,
  workflowId: 'wf-1',
  workspaceId: 'ws-default',
  name: 'Deploy to Production',
  version: 3,
  active: true,
  executionTier: 'HumanApprove',
  triggerKind: 'Manual',
  actions: [],
};

describe('ProvenanceJourney', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders "How we got here" heading', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} />);
    expect(screen.getByText(/how we got here/i)).toBeTruthy();
  });

  it('renders Approval Gate step', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} />);
    expect(screen.getByText('Approval Gate')).toBeTruthy();
  });

  it('renders workflow name when workflow is provided', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} run={BASE_RUN} workflow={BASE_WORKFLOW} />);
    expect(screen.getByText('Deploy to Production')).toBeTruthy();
  });

  it('renders workflow version', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} workflow={BASE_WORKFLOW} />);
    expect(screen.getByText('v3')).toBeTruthy();
  });

  it('renders run status', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} run={BASE_RUN} />);
    expect(screen.getByText(/Run:/)).toBeTruthy();
  });

  it('renders initiator label', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} run={BASE_RUN} />);
    expect(screen.getByText(/user-alice/)).toBeTruthy();
  });

  it('shows trigger label for Manual trigger', () => {
    render(<ProvenanceJourney approval={BASE_APPROVAL} workflow={BASE_WORKFLOW} />);
    expect(screen.getByText('Manually triggered')).toBeTruthy();
  });

  it('shows trigger label for Cron trigger', () => {
    const workflow = { ...BASE_WORKFLOW, triggerKind: 'Cron' as const };
    render(<ProvenanceJourney approval={BASE_APPROVAL} workflow={workflow} />);
    expect(screen.getByText('Scheduled (cron)')).toBeTruthy();
  });

  it('shows action count when workflow has actions', () => {
    const workflow = {
      ...BASE_WORKFLOW,
      actions: [{ actionId: 'a1' }, { actionId: 'a2' }] as WorkflowSummary['actions'],
    };
    render(<ProvenanceJourney approval={BASE_APPROVAL} workflow={workflow} />);
    expect(screen.getByText('2 steps')).toBeTruthy();
  });

  it('renders decision history entries', () => {
    const approval = {
      ...BASE_APPROVAL,
      decisionHistory: [
        {
          type: 'changes_requested' as const,
          actor: 'user-bob',
          message: 'Please clarify scope',
          timestamp: '2026-02-20T00:00:00.000Z',
        },
      ],
    };
    render(<ProvenanceJourney approval={approval} />);
    expect(screen.getByText(/changes requested by user-bob/)).toBeTruthy();
    expect(screen.getByText('Please clarify scope')).toBeTruthy();
  });

  it('shows assignee in approval gate when assigneeUserId is set', () => {
    const approval = { ...BASE_APPROVAL, assigneeUserId: 'user-carol' };
    render(<ProvenanceJourney approval={approval} />);
    expect(screen.getByText(/assigned to user-carol/)).toBeTruthy();
  });

  it('shows agent participants when run has agentIds', () => {
    const run = { ...BASE_RUN, agentIds: ['agent-001', 'agent-002'] };
    render(<ProvenanceJourney approval={BASE_APPROVAL} run={run} />);
    expect(screen.getByText('2 agents')).toBeTruthy();
  });

  it('shows robot participants when run has robotIds', () => {
    const run = { ...BASE_RUN, robotIds: ['robot-01'] };
    render(<ProvenanceJourney approval={BASE_APPROVAL} run={run} />);
    expect(screen.getByText('1 robot')).toBeTruthy();
  });
});
