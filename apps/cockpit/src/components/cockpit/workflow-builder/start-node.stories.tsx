import type { Meta, StoryObj } from '@storybook/react';
import { ReactFlowProvider } from '@xyflow/react';
import { StartNode } from './start-node';

function withFlow(Story: React.ComponentType) {
  return (
    <ReactFlowProvider>
      <div style={{ padding: 32 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof StartNode> = {
  title: 'Cockpit/WorkflowBuilder/StartNode',
  component: StartNode,
  decorators: [withFlow],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof StartNode>;

const baseProps = {
  id: 'node-start',
  type: 'start',
  position: { x: 0, y: 0 },
  data: { label: 'Start' },
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
