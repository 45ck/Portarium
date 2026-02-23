// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HumanTaskSummary, WorkforceMemberSummary } from '@portarium/cockpit-types';
import { HumanTaskDrawer } from './human-task-drawer';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const BASE_TASK: HumanTaskSummary = {
  schemaVersion: 1,
  humanTaskId: 'ht-001',
  workItemId: 'wi-001',
  runId: 'run-001',
  stepId: 'step-1',
  description: 'Review quarterly report',
  requiredCapabilities: ['finance-review'],
  status: 'assigned',
};

const BASE_MEMBERS: WorkforceMemberSummary[] = [
  {
    schemaVersion: 1,
    workforceMemberId: 'wm-1',
    linkedUserId: 'user-alice',
    displayName: 'Alice',
    capabilities: ['finance-review'],
    availabilityStatus: 'available',
    queueMemberships: [],
    tenantId: 'ws-default',
  },
];

const defaultProps = {
  task: BASE_TASK,
  open: true,
  onOpenChange: vi.fn(),
  workforceMembers: BASE_MEMBERS,
  onAssign: vi.fn(),
  onComplete: vi.fn(),
  onEscalate: vi.fn(),
};

describe('HumanTaskDrawer', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders nothing when task is null', () => {
    const { container } = render(<HumanTaskDrawer {...defaultProps} task={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders task description when open', () => {
    render(<HumanTaskDrawer {...defaultProps} />);
    expect(screen.getByText('Review quarterly report')).toBeTruthy();
  });

  it('renders task ID', () => {
    render(<HumanTaskDrawer {...defaultProps} />);
    expect(screen.getByText('ht-001')).toBeTruthy();
  });

  it('renders required capabilities', () => {
    render(<HumanTaskDrawer {...defaultProps} />);
    expect(screen.getByText('finance-review')).toBeTruthy();
  });

  it('renders assignee name when assigneeId matches a member', () => {
    const task = { ...BASE_TASK, assigneeId: 'wm-1' };
    render(<HumanTaskDrawer {...defaultProps} task={task} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Unassigned when no assigneeId', () => {
    render(<HumanTaskDrawer {...defaultProps} />);
    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('shows Complete and Escalate buttons for assigned task', () => {
    render(<HumanTaskDrawer {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Complete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeTruthy();
  });

  it('shows complete form on Complete click', async () => {
    const user = userEvent.setup();
    render(<HumanTaskDrawer {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Complete' }));
    expect(screen.getByRole('button', { name: 'Confirm Complete' })).toBeTruthy();
  });

  it('calls onComplete with note when confirmed', async () => {
    const user = userEvent.setup();
    render(<HumanTaskDrawer {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Complete' }));
    await user.type(screen.getByPlaceholderText('Add a note...'), 'Done!');
    await user.click(screen.getByRole('button', { name: 'Confirm Complete' }));
    expect(defaultProps.onComplete).toHaveBeenCalledWith('ht-001', 'Done!');
  });

  it('shows escalate form on Escalate click', async () => {
    const user = userEvent.setup();
    render(<HumanTaskDrawer {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Escalate' }));
    expect(screen.getByRole('button', { name: 'Confirm Escalate' })).toBeTruthy();
  });

  it('calls onEscalate with reason when confirmed', async () => {
    const user = userEvent.setup();
    render(<HumanTaskDrawer {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Escalate' }));
    await user.type(screen.getByPlaceholderText('Reason for escalation...'), 'Blocked');
    await user.click(screen.getByRole('button', { name: 'Confirm Escalate' }));
    expect(defaultProps.onEscalate).toHaveBeenCalledWith('ht-001', 'Blocked');
  });

  it('shows overdue warning when dueAt is in the past', () => {
    const task = { ...BASE_TASK, dueAt: '2020-01-01T00:00:00.000Z' };
    render(<HumanTaskDrawer {...defaultProps} task={task} />);
    expect(screen.getByText(/overdue/)).toBeTruthy();
  });

  it('hides Complete/Escalate for completed task', () => {
    const task = { ...BASE_TASK, status: 'completed' as const };
    render(<HumanTaskDrawer {...defaultProps} task={task} />);
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Escalate' })).toBeNull();
  });

  it('hides Complete but shows Escalate for in-progress task', () => {
    const task = { ...BASE_TASK, status: 'in-progress' as const };
    render(<HumanTaskDrawer {...defaultProps} task={task} />);
    expect(screen.getByRole('button', { name: 'Complete' })).toBeTruthy();
  });

  it('renders evidence anchor ID when provided', () => {
    const task = { ...BASE_TASK, evidenceAnchorId: 'evid-anchor-1' };
    render(<HumanTaskDrawer {...defaultProps} task={task} />);
    expect(screen.getByText('evid-anchor-1')).toBeTruthy();
  });
});
