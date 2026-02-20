import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from '@/components/cockpit/data-table';

interface SampleRow {
  id: string;
  name: string;
  status: string;
  count: number;
}

const meta: Meta<typeof DataTable<SampleRow>> = {
  title: 'Cockpit/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof DataTable<SampleRow>>;

const sampleColumns = [
  { key: 'name', header: 'Name' },
  { key: 'status', header: 'Status', width: '120px' },
  { key: 'count', header: 'Count', width: '80px' },
];

const sampleData: SampleRow[] = [
  { id: '1', name: 'Workflow Alpha', status: 'Active', count: 42 },
  { id: '2', name: 'Workflow Beta', status: 'Paused', count: 17 },
  { id: '3', name: 'Workflow Gamma', status: 'Completed', count: 89 },
];

export const Default: Story = {
  args: {
    columns: sampleColumns,
    data: sampleData,
    getRowKey: (row: SampleRow) => row.id,
  },
};

export const Loading: Story = {
  args: {
    columns: sampleColumns,
    data: [],
    loading: true,
    getRowKey: (row: SampleRow) => row.id,
  },
};

export const Empty: Story = {
  args: {
    columns: sampleColumns,
    data: [],
    getRowKey: (row: SampleRow) => row.id,
  },
};
