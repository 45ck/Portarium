import type { Meta, StoryObj } from '@storybook/react'
import { SodConstraintBadge } from './SodConstraintBadge'

const meta: Meta<typeof SodConstraintBadge> = {
  title: 'Cockpit/SodConstraintBadge',
  component: SodConstraintBadge,
}
export default meta
type Story = StoryObj<typeof SodConstraintBadge>

export const Passed: Story = {
  args: {
    constraint: 'Requester cannot approve own request',
    passed: true,
  },
}

export const Failed: Story = {
  args: {
    constraint: 'Requester cannot approve own request',
    passed: false,
  },
}
