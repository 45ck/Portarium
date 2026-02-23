import type { Meta, StoryObj } from '@storybook/react';
import { ErrorBoundary } from './error-boundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Cockpit/ErrorBoundary',
  component: ErrorBoundary,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ErrorBoundary>;

// Component that always throws
function AlwaysThrows(): React.ReactNode {
  throw new Error('Simulated render error: unexpected null reference');
}

export const NormalChildren: Story = {
  args: {
    children: (
      <div className="p-4 border rounded">
        <p>Normal content renders here without errors.</p>
      </div>
    ),
  },
};

export const CaughtError: Story = {
  render: () => (
    <ErrorBoundary>
      <AlwaysThrows />
    </ErrorBoundary>
  ),
};

export const CustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-4 border border-destructive rounded text-destructive text-sm">
          Custom fallback: This section failed to load. Please try again.
        </div>
      }
    >
      <AlwaysThrows />
    </ErrorBoundary>
  ),
};
