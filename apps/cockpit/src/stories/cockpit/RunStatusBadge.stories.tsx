import type { Meta, StoryObj } from '@storybook/react';
import { RunStatusBadge } from '@/components/cockpit/run-status-badge';

const meta: Meta<typeof RunStatusBadge> = {
  title: 'Cockpit/RunStatusBadge',
  component: RunStatusBadge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof RunStatusBadge>;

export const Pending: Story = { args: { status: 'Pending' } };
export const Running: Story = { args: { status: 'Running' } };
export const WaitingForApproval: Story = { args: { status: 'WaitingForApproval' } };
export const Paused: Story = { args: { status: 'Paused' } };
export const Succeeded: Story = { args: { status: 'Succeeded' } };
export const Failed: Story = { args: { status: 'Failed' } };
export const Cancelled: Story = { args: { status: 'Cancelled' } };
