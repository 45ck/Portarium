import type { Meta, StoryObj } from '@storybook/react'
import { EvidenceCategoryBadge } from './EvidenceCategoryBadge'

const meta: Meta<typeof EvidenceCategoryBadge> = {
  title: 'Cockpit/EvidenceCategoryBadge',
  component: EvidenceCategoryBadge,
}
export default meta
type Story = StoryObj<typeof EvidenceCategoryBadge>

export const AllCategories: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(['Plan', 'Action', 'Approval', 'Policy', 'System'] as const).map(
        (category) => (
          <div key={category} className="flex flex-col items-center gap-1">
            <EvidenceCategoryBadge category={category} />
            <span className="text-xs text-[rgb(var(--muted))]">{category}</span>
          </div>
        ),
      )}
    </div>
  ),
}
