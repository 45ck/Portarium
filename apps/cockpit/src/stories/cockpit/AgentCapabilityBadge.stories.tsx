import type { Meta, StoryObj } from '@storybook/react';
import { AgentCapabilityBadge } from '@/components/cockpit/agent-capability-badge';

const meta: Meta<typeof AgentCapabilityBadge> = {
  title: 'Cockpit/AgentCapabilityBadge',
  component: AgentCapabilityBadge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AgentCapabilityBadge>;

export const ReadExternal: Story = { args: { capability: 'read:external' } };
export const WriteExternal: Story = { args: { capability: 'write:external' } };
export const Classify: Story = { args: { capability: 'classify' } };
export const Generate: Story = { args: { capability: 'generate' } };
export const Analyze: Story = { args: { capability: 'analyze' } };
export const ExecuteCode: Story = { args: { capability: 'execute-code' } };
export const Notify: Story = { args: { capability: 'notify' } };
