import type { Meta, StoryObj } from '@storybook/react';
import { KpiRow } from './kpi-row';

const meta: Meta<typeof KpiRow> = {
  title: 'Cockpit/KpiRow',
  component: KpiRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof KpiRow>;

export const Basic: Story = {
  args: {
    stats: [
      { label: 'Active Runs', value: 12 },
      { label: 'Pending Approvals', value: 3 },
      { label: 'Workflows', value: 47 },
      { label: 'SLA Breaches', value: 0 },
    ],
  },
};

export const WithTrends: Story = {
  args: {
    stats: [
      {
        label: 'Active Runs',
        value: 12,
        trend: 'up',
        trendValue: '+4',
        description: 'vs last week',
      },
      {
        label: 'Failed Runs',
        value: 2,
        trend: 'down',
        trendValue: '-1',
        description: 'vs last week',
      },
      {
        label: 'Avg Duration',
        value: '3.2m',
        trend: 'neutral',
        trendValue: '±0',
        description: 'no change',
      },
      { label: 'Success Rate', value: '94%', trend: 'up', trendValue: '+2%' },
    ],
  },
};

export const SingleStat: Story = {
  args: {
    stats: [{ label: 'Total Workflows', value: 142 }],
  },
};

export const TwoStats: Story = {
  args: {
    stats: [
      { label: 'Open Work Items', value: 8, trend: 'up', trendValue: '+3' },
      { label: 'Resolved Today', value: 5, trend: 'neutral', trendValue: '0' },
    ],
  },
};
