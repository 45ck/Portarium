import type { Meta, StoryObj } from '@storybook/react'
import { TopBar } from './TopBar'

const meta: Meta<typeof TopBar> = {
  title: 'Cockpit/TopBar',
  component: TopBar,
}
export default meta
type Story = StoryObj<typeof TopBar>

export const Default: Story = {
  args: {
    onCommandPaletteOpen: () => console.log('Open command palette'),
  },
}

export const WithWorkspace: Story = {
  args: {
    workspaceId: 'acme-corp',
    personaLabel: 'Operator',
    onCommandPaletteOpen: () => console.log('Open command palette'),
  },
}
