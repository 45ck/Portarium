import type { Meta, StoryObj } from '@storybook/react'
import { Inbox } from 'lucide-react'
import { NavItem } from './NavItem'

const meta: Meta<typeof NavItem> = {
  title: 'Cockpit/NavItem',
  component: NavItem,
}
export default meta
type Story = StoryObj<typeof NavItem>

export const Default: Story = {
  args: {
    label: 'Work Items',
    onClick: () => console.log('Clicked'),
  },
}

export const Active: Story = {
  args: {
    label: 'Inbox',
    active: true,
    onClick: () => console.log('Clicked'),
  },
}

export const WithIcon: Story = {
  args: {
    label: 'Inbox',
    icon: <Inbox className="h-4 w-4" />,
    onClick: () => console.log('Clicked'),
  },
}
