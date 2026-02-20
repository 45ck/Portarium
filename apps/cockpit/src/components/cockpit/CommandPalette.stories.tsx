import type { Meta, StoryObj } from '@storybook/react'
import { CommandPalette } from './CommandPalette'

const meta: Meta<typeof CommandPalette> = {
  title: 'Cockpit/CommandPalette',
  component: CommandPalette,
}
export default meta
type Story = StoryObj<typeof CommandPalette>

export const Open: Story = {
  args: {
    open: true,
    onOpenChange: (open) => console.log('onOpenChange:', open),
  },
}

export const Closed: Story = {
  args: {
    open: false,
    onOpenChange: (open) => console.log('onOpenChange:', open),
  },
}
