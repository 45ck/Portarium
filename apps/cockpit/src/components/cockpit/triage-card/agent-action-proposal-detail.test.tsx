// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentActionProposalMeta } from '@portarium/cockpit-types';
import { AgentActionProposalDetail } from './agent-action-proposal-detail';

const BASE_PROPOSAL: AgentActionProposalMeta = {
  proposalId: 'prop-001',
  agentId: 'agent-test-1',
  toolName: 'file_write',
  toolCategory: 'Mutation',
  blastRadiusTier: 'HumanApprove',
  rationale: 'Writing to production config requires human oversight.',
};

describe('AgentActionProposalDetail', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the section heading', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('Agent Action Proposal')).toBeTruthy();
  });

  it('renders tool name', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('file_write')).toBeTruthy();
  });

  it('renders tool category badge', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('Mutation')).toBeTruthy();
  });

  it('renders blast-radius tier badge', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('Human Approve')).toBeTruthy();
  });

  it('renders rationale text', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('Writing to production config requires human oversight.')).toBeTruthy();
  });

  it('renders agent ID', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.getByText('agent-test-1')).toBeTruthy();
  });

  it('renders machine ID when present', () => {
    const proposalWithMachine: AgentActionProposalMeta = {
      ...BASE_PROPOSAL,
      machineId: 'machine-alpha',
    };
    render(<AgentActionProposalDetail proposal={proposalWithMachine} />);
    expect(screen.getByText('machine-alpha')).toBeTruthy();
  });

  it('does not render machine row when machineId is absent', () => {
    render(<AgentActionProposalDetail proposal={BASE_PROPOSAL} />);
    expect(screen.queryByText('Machine')).toBeNull();
  });

  it('renders ReadOnly category correctly', () => {
    const proposal: AgentActionProposalMeta = {
      ...BASE_PROPOSAL,
      toolCategory: 'ReadOnly',
    };
    render(<AgentActionProposalDetail proposal={proposal} />);
    expect(screen.getByText('Read-only')).toBeTruthy();
  });

  it('renders Dangerous category correctly', () => {
    const proposal: AgentActionProposalMeta = {
      ...BASE_PROPOSAL,
      toolCategory: 'Dangerous',
    };
    render(<AgentActionProposalDetail proposal={proposal} />);
    expect(screen.getByText('Dangerous')).toBeTruthy();
  });

  it('renders Auto tier correctly', () => {
    const proposal: AgentActionProposalMeta = {
      ...BASE_PROPOSAL,
      blastRadiusTier: 'Auto',
    };
    render(<AgentActionProposalDetail proposal={proposal} />);
    expect(screen.getByText('Auto')).toBeTruthy();
  });
});
