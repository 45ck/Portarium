import type { Meta, StoryObj } from '@storybook/react'
import { EmptyState } from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'Cockpit/EmptyState',
  component: EmptyState,
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const WithAction: Story = {
  args: {
    title: 'No work items yet',
    description: 'Create your first work item to get started with operations tracking.',
    action: { label: 'Create Work Item', onClick: () => {} },
  },
}

export const WithoutAction: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your filters to see more items.',
  },
}
