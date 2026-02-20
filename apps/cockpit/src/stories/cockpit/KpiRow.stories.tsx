import type { Meta, StoryObj } from '@storybook/react'
import { KpiRow } from '@/components/cockpit/kpi-row'

const meta: Meta<typeof KpiRow> = {
  title: 'Cockpit/KpiRow',
  component: KpiRow,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof KpiRow>

export const Default: Story = {
  args: {
    stats: [
      { label: 'Active Runs', value: 12 },
      { label: 'Pending Approvals', value: 3 },
      { label: 'Completed Today', value: 47 },
      { label: 'SLA at Risk', value: 1 },
    ],
  },
}

export const WithTrends: Story = {
  args: {
    stats: [
      { label: 'Success Rate', value: '94%', trend: 'up', trendValue: '+2%' },
      { label: 'Avg Duration', value: '1.2h', trend: 'down', trendValue: '-0.3h' },
      { label: 'Throughput', value: 156, trend: 'neutral', trendValue: '0%' },
    ],
  },
}
