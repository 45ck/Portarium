import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionTierBadge } from '@/components/cockpit/execution-tier-badge';

const meta: Meta<typeof ExecutionTierBadge> = {
  title: 'Cockpit/ExecutionTierBadge',
  component: ExecutionTierBadge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ExecutionTierBadge>;

export const Auto: Story = { args: { tier: 'Auto' } };
export const Assisted: Story = { args: { tier: 'Assisted' } };
export const HumanApprove: Story = { args: { tier: 'HumanApprove' } };
export const ManualOnly: Story = { args: { tier: 'ManualOnly' } };
