import type { Meta, StoryObj } from '@storybook/react'
import { SystemStateBanner } from './SystemStateBanner'

const meta: Meta<typeof SystemStateBanner> = {
  title: 'Cockpit/SystemStateBanner',
  component: SystemStateBanner,
}
export default meta
type Story = StoryObj<typeof SystemStateBanner>

export const Normal: Story = {
  args: { state: 'normal' },
}

export const Empty: Story = {
  args: { state: 'empty' },
}

export const Misconfigured: Story = {
  args: { state: 'misconfigured' },
}

export const PolicyBlocked: Story = {
  args: { state: 'policy-blocked' },
}

export const RbacLimited: Story = {
  args: { state: 'rbac-limited' },
}

export const Degraded: Story = {
  args: { state: 'degraded' },
}
