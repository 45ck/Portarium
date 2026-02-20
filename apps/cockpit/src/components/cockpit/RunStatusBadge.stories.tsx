import type { Meta, StoryObj } from '@storybook/react'
import { RunStatusBadge } from './RunStatusBadge'

const meta: Meta<typeof RunStatusBadge> = {
  title: 'Cockpit/RunStatusBadge',
  component: RunStatusBadge,
}
export default meta
type Story = StoryObj<typeof RunStatusBadge>

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['Pending', 'Running', 'WaitingForApproval', 'Paused', 'Succeeded', 'Failed', 'Cancelled'] as const).map(
        (status) => (
          <div key={status} className="flex flex-col items-center gap-1">
            <RunStatusBadge status={status} />
            <span className="text-xs text-[rgb(var(--muted))]">{status}</span>
          </div>
        ),
      )}
    </div>
  ),
}
