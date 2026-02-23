import type { Meta, StoryObj } from '@storybook/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ApprovalGateNode } from './approval-gate-node';

function withFlow(Story: React.ComponentType) {
  return (
    <ReactFlowProvider>
      <div style={{ padding: 32 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof ApprovalGateNode> = {
  title: 'Cockpit/WorkflowBuilder/ApprovalGateNode',
  component: ApprovalGateNode,
  decorators: [withFlow],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ApprovalGateNode>;

const baseProps = {
  id: 'node-gate-1',
  type: 'approvalGate',
  position: { x: 0, y: 0 },
  data: { label: 'Production Approval' },
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

export const CustomLabel: Story = {
  args: { ...baseProps, data: { label: 'Finance Sign-off Required' } },
};
