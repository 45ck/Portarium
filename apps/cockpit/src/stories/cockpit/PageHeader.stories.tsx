import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from '@/components/cockpit/page-header';

const meta: Meta<typeof PageHeader> = {
  title: 'Cockpit/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: 'Dashboard',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Evidence',
    description: 'Immutable audit trail for all workspace activity',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Runs',
    description: 'Active and completed automation runs',
    action: (
      <button className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md">
        New Run
      </button>
    ),
  },
};

export const WithBreadcrumb: Story = {
  args: {
    title: 'Run Detail',
    breadcrumb: [{ label: 'Runs', to: '/runs' }, { label: 'run-001' }],
  },
};
