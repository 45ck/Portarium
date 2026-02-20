import type { Meta, StoryObj } from '@storybook/react'
import { StatusBar } from './StatusBar'

const meta: Meta<typeof StatusBar> = {
  title: 'Cockpit/StatusBar',
  component: StatusBar,
}
export default meta
type Story = StoryObj<typeof StatusBar>

export const AllGood: Story = {
  args: {
    runCount: 3,
    chainStatus: 'verified',
    streamStatus: 'live',
    onOpenCommandPalette: () => console.log('Open command palette'),
    onOpenCheatsheet: () => console.log('Open cheatsheet'),
  },
}

export const WithFailedChain: Story = {
  args: {
    runCount: 1,
    chainStatus: 'failed',
    streamStatus: 'live',
    onOpenCommandPalette: () => console.log('Open command palette'),
    onOpenCheatsheet: () => console.log('Open cheatsheet'),
  },
}

export const Degraded: Story = {
  args: {
    runCount: 0,
    chainStatus: 'pending',
    streamStatus: 'degraded',
    onOpenCommandPalette: () => console.log('Open command palette'),
    onOpenCheatsheet: () => console.log('Open cheatsheet'),
  },
}
