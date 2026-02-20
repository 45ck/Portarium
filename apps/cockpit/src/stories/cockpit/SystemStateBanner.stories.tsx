import type { Meta, StoryObj } from '@storybook/react';
import { SystemStateBanner } from '@/components/cockpit/system-state-banner';

const meta: Meta<typeof SystemStateBanner> = {
  title: 'Cockpit/SystemStateBanner',
  component: SystemStateBanner,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SystemStateBanner>;

export const Healthy: Story = { args: { state: 'healthy' } };
export const Degraded: Story = { args: { state: 'degraded' } };
export const Incident: Story = { args: { state: 'incident' } };
export const Maintenance: Story = {
  args: { state: 'maintenance', message: 'Scheduled maintenance window until 06:00 UTC.' },
};
