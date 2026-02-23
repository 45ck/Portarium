import type { Meta, StoryObj } from '@storybook/react';
import { EffectsList } from './effects-list';
import type { PlanEffect, PredictedPlanEffect } from '@portarium/cockpit-types';

const meta: Meta<typeof EffectsList> = {
  title: 'Cockpit/EffectsList',
  component: EffectsList,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof EffectsList>;

const PLANNED: PlanEffect[] = [
  {
    effectId: 'eff-1',
    operation: 'Create',
    target: {
      sorName: 'salesforce',
      portFamily: 'crm',
      externalId: 'acct-001',
      externalType: 'Account',
    },
    summary: 'Create new Account record for Acme Corp',
  },
  {
    effectId: 'eff-2',
    operation: 'Update',
    target: {
      sorName: 'salesforce',
      portFamily: 'crm',
      externalId: 'opp-002',
      externalType: 'Opportunity',
    },
    summary: 'Set stage to Closed Won',
  },
];

const PREDICTED: PredictedPlanEffect[] = [
  {
    effectId: 'eff-3',
    operation: 'Update',
    target: { sorName: 'hubspot', portFamily: 'crm', externalId: 'deal-007', externalType: 'Deal' },
    summary: 'Sync deal stage to Closed Won',
    confidence: 0.87,
  },
];

const VERIFIED: PlanEffect[] = [
  {
    effectId: 'eff-1',
    operation: 'Create',
    target: {
      sorName: 'salesforce',
      portFamily: 'crm',
      externalId: 'acct-001',
      externalType: 'Account',
    },
    summary: 'Account 0018Z000004fGhQ created',
  },
];

export const PlannedOnly: Story = {
  args: { planned: PLANNED },
};

export const WithPredicted: Story = {
  args: { planned: PLANNED, predicted: PREDICTED },
};

export const WithVerified: Story = {
  args: { planned: PLANNED, verified: VERIFIED },
};

export const AllSections: Story = {
  args: { planned: PLANNED, predicted: PREDICTED, verified: VERIFIED },
};

export const Empty: Story = {
  args: { planned: [] },
};

export const DeleteEffect: Story = {
  args: {
    planned: [
      {
        effectId: 'eff-del-1',
        operation: 'Delete',
        target: {
          sorName: 'netsuite',
          portFamily: 'erp',
          externalId: 'inv-99',
          externalType: 'Invoice',
        },
        summary: 'Remove draft invoice before submission',
      },
    ],
  },
};

export const UpsertEffect: Story = {
  args: {
    planned: [
      {
        effectId: 'eff-ups-1',
        operation: 'Upsert',
        target: {
          sorName: 'stripe',
          portFamily: 'billing',
          externalId: 'cust-abc',
          externalType: 'Customer',
        },
        summary: 'Create or update Stripe customer',
      },
    ],
  },
};
