import type { Meta, StoryObj } from '@storybook/react';
import { ApprovalStatusBadge } from './approval-status-badge';

const meta: Meta<typeof ApprovalStatusBadge> = {
  title: 'Cockpit/ApprovalStatusBadge',
  component: ApprovalStatusBadge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ApprovalStatusBadge>;

export const Pending: Story = { args: { status: 'Pending' } };
export const Approved: Story = { args: { status: 'Approved' } };
export const Denied: Story = { args: { status: 'Denied' } };
export const RequestChanges: Story = { args: { status: 'RequestChanges' } };

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['Pending', 'Approved', 'Denied', 'RequestChanges'] as const).map((s) => (
        <ApprovalStatusBadge key={s} status={s} />
      ))}
    </div>
  ),
};
