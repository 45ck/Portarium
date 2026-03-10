// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentActionProposalMeta, PolicyRule } from '@portarium/cockpit-types';
import { AgentActionContextPanel } from './agent-action-context-panel';

const FULL_PROPOSAL: AgentActionProposalMeta = {
  proposalId: 'prop-ctx-001',
  agentId: 'agent-alpha',
  machineId: 'machine-prod-1',
  toolName: 'send_email',
  toolCategory: 'Mutation',
  blastRadiusTier: 'HumanApprove',
  rationale: 'Agent wants to send a notification email to the client.',
};

const POLICY_RULE: PolicyRule = {
  ruleId: 'pol-email-001',
  trigger: 'send_email with external recipient',
  tier: 'HumanApprove',
  blastRadius: ['external-comms', 'client-facing'],
  irreversibility: 'full',
};

describe('AgentActionContextPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the section heading', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('Agent Action Context')).toBeTruthy();
  });

  it('renders agent ID', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('agent-alpha')).toBeTruthy();
  });

  it('renders machine ID when present', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('machine-prod-1')).toBeTruthy();
  });

  it('does not render machine row when machineId is absent', () => {
    const minimal: AgentActionProposalMeta = {
      proposalId: 'prop-ctx-002',
      agentId: 'agent-beta',
      toolName: 'read_file',
      toolCategory: 'ReadOnly',
      blastRadiusTier: 'Auto',
      rationale: 'Reading a config file for analysis.',
    };
    render(<AgentActionContextPanel proposal={minimal} />);
    expect(screen.queryByText('Machine:')).toBeNull();
  });

  it('renders tool name', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('send_email')).toBeTruthy();
  });

  it('renders tool category badge', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('Mutation')).toBeTruthy();
  });

  it('renders blast-radius tier badge', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByText('Human Approve')).toBeTruthy();
  });

  it('renders agent rationale', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(
      screen.getByText('Agent wants to send a notification email to the client.'),
    ).toBeTruthy();
  });

  it('renders Dangerous category correctly', () => {
    const dangerous: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'Dangerous',
      blastRadiusTier: 'ManualOnly',
    };
    render(<AgentActionContextPanel proposal={dangerous} />);
    expect(screen.getByText('Dangerous')).toBeTruthy();
    expect(screen.getByText('Manual Only')).toBeTruthy();
  });

  it('renders ReadOnly category with Auto tier correctly', () => {
    const readOnly: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'ReadOnly',
      blastRadiusTier: 'Auto',
    };
    render(<AgentActionContextPanel proposal={readOnly} />);
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.getByText('Auto-approved')).toBeTruthy();
  });

  it('applies destructive border when tool is dangerous', () => {
    const dangerous: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'Dangerous',
    };
    const { container } = render(<AgentActionContextPanel proposal={dangerous} />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('border-destructive');
  });

  it('does not render policy section when policyRule is absent', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.queryByText('Policy Evaluation')).toBeNull();
  });

  it('renders policy evaluation when policyRule is provided', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} policyRule={POLICY_RULE} />);
    expect(screen.getByText('Policy Evaluation')).toBeTruthy();
    expect(screen.getByText('pol-email-001')).toBeTruthy();
    expect(screen.getByText('send_email with external recipient')).toBeTruthy();
    expect(screen.getByText('Fully irreversible')).toBeTruthy();
  });

  it('renders blast radius badges from policy rule', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} policyRule={POLICY_RULE} />);
    expect(screen.getByText('external-comms')).toBeTruthy();
    expect(screen.getByText('client-facing')).toBeTruthy();
  });

  it('renders partial reversibility from policy rule', () => {
    const partialRule: PolicyRule = {
      ...POLICY_RULE,
      irreversibility: 'partial',
    };
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} policyRule={partialRule} />);
    expect(screen.getByText('Partially reversible')).toBeTruthy();
  });

  it('renders reversible from policy rule', () => {
    const reversibleRule: PolicyRule = {
      ...POLICY_RULE,
      irreversibility: 'none',
      blastRadius: [],
    };
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} policyRule={reversibleRule} />);
    expect(screen.getByText('Reversible')).toBeTruthy();
  });

  it('has accessible section label', () => {
    render(<AgentActionContextPanel proposal={FULL_PROPOSAL} />);
    expect(screen.getByRole('region', { name: 'Agent action context' })).toBeTruthy();
  });

  it('renders Unknown tool category badge', () => {
    const unknown: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'Unknown',
      blastRadiusTier: 'Auto',
    };
    render(<AgentActionContextPanel proposal={unknown} />);
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('renders Assisted blast-radius tier badge', () => {
    const assisted: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'ReadOnly',
      blastRadiusTier: 'Assisted',
    };
    render(<AgentActionContextPanel proposal={assisted} />);
    expect(screen.getByText('Assisted')).toBeTruthy();
  });

  it('applies destructive border when blastRadiusTier is ManualOnly with Mutation category', () => {
    const manualMutation: AgentActionProposalMeta = {
      ...FULL_PROPOSAL,
      toolCategory: 'Mutation',
      blastRadiusTier: 'ManualOnly',
    };
    const { container } = render(<AgentActionContextPanel proposal={manualMutation} />);
    const section = container.querySelector('section');
    expect(section?.className).toContain('border-destructive');
  });
});
