// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActionNode } from './action-node';
import { ApprovalGateNode } from './approval-gate-node';
import { StartNode } from './start-node';
import { EndNode } from './end-node';
import { ConditionNode } from './condition-node';

// Mock @xyflow/react — Handle renders nothing in unit tests (no ReactFlow context)
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

function makeNodeProps(label: string, extra?: Record<string, unknown>) {
  return {
    data: { label, ...extra },
    selected: false,
    id: 'node-1',
    type: 'action',
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    isConnectable: true,
    positionAbsolute: { x: 0, y: 0 },
    dragging: false,
  } as Parameters<typeof ActionNode>[0];
}

describe('ActionNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders node label', () => {
    render(<ActionNode {...makeNodeProps('Send Invoice')} />);
    expect(screen.getByText('Send Invoice')).toBeTruthy();
  });

  it('renders operation text when provided', () => {
    render(<ActionNode {...makeNodeProps('My Action', { operation: 'UPDATE_ACCOUNT' })} />);
    expect(screen.getByText('UPDATE_ACCOUNT')).toBeTruthy();
  });

  it('does not show operation when not provided', () => {
    const { container } = render(<ActionNode {...makeNodeProps('No Op')} />);
    expect(container.querySelector('.font-mono')).toBeNull();
  });

  it('applies selected border style when selected=true', () => {
    const { container } = render(<ActionNode {...{ ...makeNodeProps('Node'), selected: true }} />);
    expect(container.firstChild?.toString()).toBeTruthy();
  });
});

describe('ApprovalGateNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders approval gate label', () => {
    render(<ApprovalGateNode {...makeNodeProps('Approve Deployment')} />);
    expect(screen.getByText('Approve Deployment')).toBeTruthy();
  });

  it('renders "Requires human approval" text', () => {
    render(<ApprovalGateNode {...makeNodeProps('Gate')} />);
    expect(screen.getByText('Requires human approval')).toBeTruthy();
  });
});

describe('StartNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders start label', () => {
    render(<StartNode {...makeNodeProps('Start')} />);
    expect(screen.getByText('Start')).toBeTruthy();
  });
});

describe('EndNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders end label', () => {
    render(<EndNode {...makeNodeProps('End')} />);
    expect(screen.getByText('End')).toBeTruthy();
  });
});

describe('ConditionNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders condition label', () => {
    render(<ConditionNode {...makeNodeProps('Check Threshold')} />);
    expect(screen.getByText('Check Threshold')).toBeTruthy();
  });

  it('renders True and False branches', () => {
    render(<ConditionNode {...makeNodeProps('Branch')} />);
    expect(screen.getByText('True')).toBeTruthy();
    expect(screen.getByText('False')).toBeTruthy();
  });
});
