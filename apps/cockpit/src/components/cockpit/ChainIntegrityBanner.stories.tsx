import type { Meta, StoryObj } from '@storybook/react'
import { ChainIntegrityBanner } from './ChainIntegrityBanner'

const meta: Meta<typeof ChainIntegrityBanner> = {
  title: 'Cockpit/ChainIntegrityBanner',
  component: ChainIntegrityBanner,
}
export default meta
type Story = StoryObj<typeof ChainIntegrityBanner>

export const Verified: Story = {
  args: { status: 'verified' },
}

export const Failed: Story = {
  args: { status: 'failed' },
}

export const Pending: Story = {
  args: { status: 'pending' },
}
