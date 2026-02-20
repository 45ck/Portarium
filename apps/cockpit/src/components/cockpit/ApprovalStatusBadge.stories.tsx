import type { Meta, StoryObj } from '@storybook/react'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'

const meta: Meta<typeof ApprovalStatusBadge> = {
  title: 'Cockpit/ApprovalStatusBadge',
  component: ApprovalStatusBadge,
}
export default meta
type Story = StoryObj<typeof ApprovalStatusBadge>

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['Pending', 'Approved', 'Denied', 'RequestChanges'] as const).map(
        (status) => (
          <div key={status} className="flex flex-col items-center gap-1">
            <ApprovalStatusBadge status={status} />
            <span className="text-xs text-[rgb(var(--muted))]">{status}</span>
          </div>
        ),
      )}
    </div>
  ),
}
