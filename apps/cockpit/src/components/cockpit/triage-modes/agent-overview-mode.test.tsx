// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgentOverviewMode } from './agent-overview-mode';
import type { ApprovalSummary, AgentV1, MachineV1 } from '@portarium/cockpit-types';

const AGENT: AgentV1 = {
  schemaVersion: 1,
  agentId: 'agent-proposal-1',
  workspaceId: 'ws-1',
  name: 'Release reviewer',
  endpoint: 'https://agent.test',
  modelId: 'gpt-5.2',
  allowedCapabilities: ['analyze', 'machine:invoke'],
  machineId: 'machine-1',
  policyTier: 'HumanApprove',
};

const MACHINE: MachineV1 = {
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: 'ws-1',
  hostname: 'release-host',
  registeredAtIso: '2026-03-11T00:00:00.000Z',
  lastHeartbeatAtIso: '2026-03-11T00:05:00.000Z',
  status: 'Online',
  allowedCapabilities: ['machine:invoke'],
};

vi.mock('@/hooks/queries/use-agents', () => ({
  useAgents: () => ({ data: { items: [AGENT] } }),
}));

vi.mock('@/hooks/queries/use-machines', () => ({
  useMachines: () => ({ data: { items: [MACHINE] } }),
}));

function makeApproval(): ApprovalSummary {
  return {
    schemaVersion: 1,
    approvalId: 'appr-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    planId: 'plan-1',
    prompt: 'Approve release action',
    status: 'Pending',
    requestedAtIso: '2026-03-11T00:00:00.000Z',
    requestedByUserId: 'user-1',
    agentActionProposal: {
      proposalId: 'proposal-1',
      agentId: 'agent-proposal-1',
      machineId: 'machine-1',
      toolName: 'deploy:release',
      toolCategory: 'Mutation',
      blastRadiusTier: 'HumanApprove',
      rationale: 'Deployment needs a human approval.',
    },
  };
}

describe('AgentOverviewMode', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses proposal agent and machine metadata when run agentIds are absent', () => {
    render(<AgentOverviewMode approval={makeApproval()} plannedEffects={[]} />);

    expect(screen.getByText('Release reviewer')).toBeTruthy();
    expect(screen.getByText('gpt-5.2')).toBeTruthy();
    expect(screen.getByText('HumanApprove')).toBeTruthy();
    expect(screen.getByText('release-host')).toBeTruthy();
    expect(screen.getByText('machine-1')).toBeTruthy();
    expect(screen.getAllByText('Machine').length).toBeGreaterThan(0);
  });
});
