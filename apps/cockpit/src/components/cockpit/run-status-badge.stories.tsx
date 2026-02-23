import type { Meta, StoryObj } from '@storybook/react';
import { RunStatusBadge } from './run-status-badge';

const meta: Meta<typeof RunStatusBadge> = {
  title: 'Cockpit/RunStatusBadge',
  component: RunStatusBadge,
  parameters: { layout: 'centered' },
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

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(
        [
          'Pending',
          'Running',
          'WaitingForApproval',
          'Paused',
          'Succeeded',
          'Failed',
          'Cancelled',
        ] as const
      ).map((s) => (
        <RunStatusBadge key={s} status={s} />
      ))}
    </div>
  ),
};
