import type { Meta, StoryObj } from '@storybook/react'
import { ExecutionTierBadge } from './ExecutionTierBadge'

const meta: Meta<typeof ExecutionTierBadge> = {
  title: 'Cockpit/ExecutionTierBadge',
  component: ExecutionTierBadge,
}
export default meta
type Story = StoryObj<typeof ExecutionTierBadge>

export const AllTiers: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const).map(
        (tier) => (
          <div key={tier} className="flex flex-col items-center gap-1">
            <ExecutionTierBadge tier={tier} />
            <span className="text-xs text-[rgb(var(--muted))]">{tier}</span>
          </div>
        ),
      )}
    </div>
  ),
}
