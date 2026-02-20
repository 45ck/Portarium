import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FilterBar } from '@/components/cockpit/filter-bar';

const meta: Meta<typeof FilterBar> = {
  title: 'Cockpit/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof FilterBar>;

const sampleFilters = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { label: 'Running', value: 'Running' },
      { label: 'Succeeded', value: 'Succeeded' },
      { label: 'Failed', value: 'Failed' },
    ],
  },
  {
    key: 'tier',
    label: 'Tier',
    options: [
      { label: 'Auto', value: 'Auto' },
      { label: 'Assisted', value: 'Assisted' },
      { label: 'Manual Only', value: 'ManualOnly' },
    ],
  },
];

function FilterBarWrapper() {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <FilterBar
      filters={sampleFilters}
      values={values}
      onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
    />
  );
}

export const Default: Story = {
  render: () => <FilterBarWrapper />,
};
