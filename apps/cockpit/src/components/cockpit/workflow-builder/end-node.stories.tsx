import type { Meta, StoryObj } from '@storybook/react';
import { ReactFlowProvider } from '@xyflow/react';
import { EndNode } from './end-node';

function withFlow(Story: React.ComponentType) {
  return (
    <ReactFlowProvider>
      <div style={{ padding: 32 }}>
        <Story />
      </div>
    </ReactFlowProvider>
  );
}

const meta: Meta<typeof EndNode> = {
  title: 'Cockpit/WorkflowBuilder/EndNode',
  component: EndNode,
  decorators: [withFlow],
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof EndNode>;

const baseProps = {
  id: 'node-end',
  type: 'end',
  position: { x: 0, y: 0 },
  data: { label: 'End' },
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
