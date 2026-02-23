import type { Meta, StoryObj } from '@storybook/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ActionNode } from './action-node';

function withFlow(Story: React.ComponentType) {
  return (
    <ReactFlowProvider>
      <div style={{ padding: 32 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof ActionNode> = {
  title: 'Cockpit/WorkflowBuilder/ActionNode',
  component: ActionNode,
  decorators: [withFlow],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ActionNode>;

const baseProps = {
  id: 'node-1',
  type: 'action',
  position: { x: 0, y: 0 },
  data: { label: 'Create Account', operation: 'salesforce/CreateAccount' },
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
};

export const Default: Story = {
  args: baseProps,
};

export const Selected: Story = {
  args: { ...baseProps, selected: true },
};

export const WithoutOperation: Story = {
  args: { ...baseProps, data: { label: 'Send Notification' } },
};

export const LongLabel: Story = {
  args: {
    ...baseProps,
    data: {
      label: 'Update Opportunity Stage to Closed Won',
      operation: 'salesforce/UpdateOpportunity',
    },
  },
};
