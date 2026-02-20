import type { Meta, StoryObj } from '@storybook/react'
import { FilterBar } from './FilterBar'

const meta: Meta<typeof FilterBar> = {
  title: 'Cockpit/FilterBar',
  component: FilterBar,
}
export default meta
type Story = StoryObj<typeof FilterBar>

const sampleFilters = [
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'mine', label: 'Assigned to me' },
]

export const Default: Story = {
  args: {
    filters: sampleFilters,
    active: [],
    onToggle: () => {},
  },
}

export const WithActiveFilter: Story = {
  args: {
    filters: sampleFilters,
    active: ['open', 'mine'],
    onToggle: () => {},
  },
}
