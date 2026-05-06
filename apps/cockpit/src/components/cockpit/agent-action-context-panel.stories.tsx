import type { Meta, StoryObj } from '@storybook/react';
import { AgentActionContextPanel } from './agent-action-context-panel';
import type { AgentActionProposalMeta, PolicyRule } from '@portarium/cockpit-types';

const meta: Meta<typeof AgentActionContextPanel> = {
  title: 'Cockpit/AgentActionContextPanel',
  component: AgentActionContextPanel,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AgentActionContextPanel>;

const BASE_PROPOSAL: AgentActionProposalMeta = {
  proposalId: 'prop-story-001',
  agentId: 'agent-ops-review',
  machineId: 'machine-prod-us-east-1',
  toolName: 'send_email',
  toolCategory: 'Mutation',
  blastRadiusTier: 'HumanApprove',
  rationale:
    'Sending notification email to client about shipment delay. The email contains PII and needs human review before dispatch.',
};

const POLICY_RULE: PolicyRule = {
  ruleId: 'pol-email-ext-001',
  trigger: 'send_email with external recipient',
  tier: 'HumanApprove',
  blastRadius: ['external-comms', 'client-facing', 'pii-exposure'],
  irreversibility: 'full',
};

export const Default: Story = {
  args: {
    proposal: BASE_PROPOSAL,
    policyRule: POLICY_RULE,
  },
};

export const DangerousTool: Story = {
  args: {
    proposal: {
      ...BASE_PROPOSAL,
      toolName: 'delete_database_records',
      toolCategory: 'Dangerous',
      blastRadiusTier: 'ManualOnly',
      rationale:
        'Purging orphaned records from the shipment tracking database. This is a destructive operation that cannot be undone.',
    },
    policyRule: {
      ...POLICY_RULE,
      ruleId: 'pol-db-delete-001',
      trigger: 'delete_database_records on production',
      tier: 'ManualOnly',
      blastRadius: ['data-loss', 'production-database'],
      irreversibility: 'full',
    },
  },
};

export const ReadOnlyAutoApproved: Story = {
  args: {
    proposal: {
      proposalId: 'prop-story-002',
      agentId: 'agent-analytics',
      toolName: 'read_temperature_logs',
      toolCategory: 'ReadOnly',
      blastRadiusTier: 'Auto',
      rationale: 'Reading temperature logs from cold chain sensors for compliance reporting.',
    },
  },
};

export const MissingOptionalFields: Story = {
  args: {
    proposal: {
      proposalId: 'prop-story-003',
      agentId: 'agent-basic',
      toolName: 'list_files',
      toolCategory: 'Unknown',
      blastRadiusTier: 'Assisted',
      rationale: 'Listing directory contents for inventory check.',
    },
  },
};

export const WithPartialReversibility: Story = {
  args: {
    proposal: {
      ...BASE_PROPOSAL,
      toolName: 'update_shipment_status',
      toolCategory: 'Mutation',
      blastRadiusTier: 'Assisted',
      rationale: 'Updating shipment status to reflect delay. Status can be reverted if needed.',
    },
    policyRule: {
      ruleId: 'pol-shipment-update-001',
      trigger: 'update_shipment_status',
      tier: 'Assisted',
      blastRadius: ['logistics'],
      irreversibility: 'partial',
    },
  },
};
