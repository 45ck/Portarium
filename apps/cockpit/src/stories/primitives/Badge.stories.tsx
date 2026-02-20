import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link', 'success', 'warning', 'info'],
    },
  },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'Default', variant: 'default' } }
export const Secondary: Story = { args: { children: 'Secondary', variant: 'secondary' } }
export const Destructive: Story = { args: { children: 'Destructive', variant: 'destructive' } }
export const Outline: Story = { args: { children: 'Outline', variant: 'outline' } }
export const Success: Story = { args: { children: 'Success', variant: 'success' } }
export const Warning: Story = { args: { children: 'Warning', variant: 'warning' } }
export const Info: Story = { args: { children: 'Info', variant: 'info' } }

export const AllVariants: Story = {
  render: () => (
    <div className="bg-background p-4 flex flex-wrap gap-2">
      {(['default','secondary','destructive','outline','success','warning','info'] as const).map(v => (
        <Badge key={v} variant={v}>{v}</Badge>
      ))}
    </div>
  ),
}

export const StatusBadges: Story = {
  name: 'Run Status (usage example)',
  render: () => (
    <div className="bg-background p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">Running</Badge>
        <Badge variant="success">Completed</Badge>
        <Badge variant="warning">Waiting for Approval</Badge>
        <Badge variant="destructive">Failed</Badge>
        <Badge variant="secondary">Queued</Badge>
        <Badge variant="outline">Cancelled</Badge>
        <Badge variant="info">Paused</Badge>
      </div>
    </div>
  ),
}
