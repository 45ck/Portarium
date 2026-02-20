import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { RationaleThread } from './RationaleThread'

const meta: Meta<typeof RationaleThread> = {
  title: 'Cockpit/RationaleThread',
  component: RationaleThread,
}
export default meta
type Story = StoryObj<typeof RationaleThread>

export const Empty: Story = {
  args: {
    required: true,
    rationale: '',
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.rationale ?? '')
    return <RationaleThread {...args} rationale={value} onChange={setValue} />
  },
}

export const Filled: Story = {
  args: {
    required: true,
    rationale: 'This deployment has been reviewed and all acceptance criteria are met.',
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.rationale ?? '')
    return <RationaleThread {...args} rationale={value} onChange={setValue} />
  },
}

export const ReadOnly: Story = {
  args: {
    required: false,
    rationale: 'Approved after thorough review of the deployment plan and rollback procedures.',
    readOnly: true,
  },
}

export const Optional: Story = {
  args: {
    required: false,
    rationale: '',
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.rationale ?? '')
    return <RationaleThread {...args} rationale={value} onChange={setValue} />
  },
}
