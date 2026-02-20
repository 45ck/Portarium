import type { Meta, StoryObj } from '@storybook/react'
import { KpiStat } from './KpiStat'

const meta: Meta<typeof KpiStat> = {
  title: 'Cockpit/KpiStat',
  component: KpiStat,
}
export default meta
type Story = StoryObj<typeof KpiStat>

export const Default: Story = {
  args: { label: 'Active Runs', value: 42 },
}

export const OK: Story = {
  args: { label: 'Uptime', value: '99.9%', status: 'ok' },
}

export const Warning: Story = {
  args: { label: 'Pending Approvals', value: 7, status: 'warn' },
}

export const Danger: Story = {
  args: { label: 'Failed Runs', value: 3, status: 'danger' },
}

export const WithTrend: Story = {
  args: { label: 'Throughput', value: 128, trend: 'up', status: 'ok' },
}
