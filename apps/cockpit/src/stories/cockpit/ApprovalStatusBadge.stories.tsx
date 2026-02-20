import type { Meta, StoryObj } from '@storybook/react'
import { ApprovalStatusBadge } from '@/components/cockpit/approval-status-badge'

const meta: Meta<typeof ApprovalStatusBadge> = {
  title: 'Cockpit/ApprovalStatusBadge',
  component: ApprovalStatusBadge,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ApprovalStatusBadge>

export const Pending: Story = { args: { status: 'Pending' } }
export const Approved: Story = { args: { status: 'Approved' } }
export const Denied: Story = { args: { status: 'Denied' } }
export const RequestChanges: Story = { args: { status: 'RequestChanges' } }
