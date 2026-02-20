import type { Meta, StoryObj } from '@storybook/react'
import { Button } from '@/components/ui/button'
import { Zap, ChevronRight, Loader2 } from 'lucide-react'

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  parameters: { layout: 'padded' },
  argTypes: {
    variant: { control: 'select', options: ['default','secondary','destructive','outline','ghost','link'] },
    size: { control: 'select', options: ['default','sm','lg','icon'] },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = { args: { children: 'Approve Run', variant: 'default' } }
export const Secondary: Story = { args: { children: 'View Details', variant: 'secondary' } }
export const Destructive: Story = { args: { children: 'Reject', variant: 'destructive' } }
export const Outline: Story = { args: { children: 'Cancel', variant: 'outline' } }
export const Ghost: Story = { args: { children: 'Dismiss', variant: 'ghost' } }
export const Small: Story = { args: { children: 'Filter', variant: 'outline', size: 'sm' } }
export const Large: Story = { args: { children: 'Start Workflow', variant: 'default', size: 'lg' } }

export const WithIcon: Story = {
  render: () => (
    <div className="bg-background p-4 flex gap-3 flex-wrap">
      <Button><Zap className="size-4" /> Run Now</Button>
      <Button variant="outline"><ChevronRight className="size-4" /> View Details</Button>
      <Button variant="secondary" disabled><Loader2 className="size-4 animate-spin" /> Processing...</Button>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="bg-background p-4 flex flex-wrap gap-3">
      {(['default','secondary','destructive','outline','ghost','link'] as const).map(v => (
        <Button key={v} variant={v}>{v}</Button>
      ))}
    </div>
  ),
}
