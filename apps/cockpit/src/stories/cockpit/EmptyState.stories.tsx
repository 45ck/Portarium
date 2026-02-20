import type { Meta, StoryObj } from '@storybook/react'
import { EmptyState } from '@/components/cockpit/empty-state'
import { Bot } from 'lucide-react'

const meta: Meta<typeof EmptyState> = {
  title: 'Cockpit/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    title: 'No items',
    description: 'There are no items to display right now.',
  },
}

export const WithAction: Story = {
  args: {
    title: 'No runs yet',
    description: 'Create your first automation run to get started.',
    action: <button className="text-xs text-primary underline">Create Run</button>,
  },
}

export const WithIcon: Story = {
  args: {
    title: 'Robotics',
    description: 'Robotics integration coming soon.',
    icon: <Bot className="h-12 w-12" />,
  },
}
