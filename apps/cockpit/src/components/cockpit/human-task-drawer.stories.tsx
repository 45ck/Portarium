import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { HumanTaskDrawer } from './human-task-drawer';
import type { HumanTaskSummary, WorkforceMemberSummary } from '@portarium/cockpit-types';

// Minimal router context for components that use TanStack Router's <Link>
function withRouter(Story: React.ComponentType) {
  const rootRoute = createRootRoute({ component: () => <Story /> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  });
  return <RouterProvider router={router} />;
}

const meta: Meta<typeof HumanTaskDrawer> = {
  title: 'Cockpit/HumanTaskDrawer',
  component: HumanTaskDrawer,
  decorators: [withRouter],
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    onAssign: fn(),
    onComplete: fn(),
    onEscalate: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof HumanTaskDrawer>;

const MEMBERS: WorkforceMemberSummary[] = [
  {
    schemaVersion: 1,
    workforceMemberId: 'wm-alice',
    linkedUserId: 'user-alice',
    displayName: 'Alice Chen',
    capabilities: ['operations.approval', 'operations.dispatch'],
    availabilityStatus: 'available',
    queueMemberships: ['q-ops'],
    tenantId: 'tenant-1',
    createdAtIso: '2026-01-01T00:00:00.000Z',
  },
  {
    schemaVersion: 1,
    workforceMemberId: 'wm-bob',
    linkedUserId: 'user-bob',
    displayName: 'Bob Singh',
    capabilities: ['operations.approval'],
    availabilityStatus: 'busy',
    queueMemberships: ['q-ops'],
    tenantId: 'tenant-1',
    createdAtIso: '2026-01-01T00:00:00.000Z',
  },
];

const BASE_TASK: HumanTaskSummary = {
  schemaVersion: 1,
  humanTaskId: 'ht-001',
  workItemId: 'wi-001',
  runId: 'run-001',
  stepId: 'step-review',
  description: 'Review and verify the quarterly financial report before submission to auditors.',
  requiredCapabilities: ['operations.approval'],
  status: 'pending',
};

export const Pending: Story = {
  args: { task: BASE_TASK, workforceMembers: MEMBERS },
};

export const Assigned: Story = {
  args: {
    task: { ...BASE_TASK, status: 'assigned', assigneeId: 'wm-alice' },
    workforceMembers: MEMBERS,
  },
};

export const InProgress: Story = {
  args: {
    task: { ...BASE_TASK, status: 'in-progress', assigneeId: 'wm-alice' },
    workforceMembers: MEMBERS,
  },
};

export const Overdue: Story = {
  args: {
    task: {
      ...BASE_TASK,
      status: 'in-progress',
      assigneeId: 'wm-alice',
      dueAt: '2025-01-01T00:00:00.000Z',
    },
    workforceMembers: MEMBERS,
  },
};

export const DueSoon: Story = {
  args: {
    task: {
      ...BASE_TASK,
      status: 'assigned',
      assigneeId: 'wm-bob',
      dueAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
    workforceMembers: MEMBERS,
  },
};

export const Completed: Story = {
  args: {
    task: {
      ...BASE_TASK,
      status: 'completed',
      assigneeId: 'wm-alice',
      completedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      completedById: 'wm-alice',
    },
    workforceMembers: MEMBERS,
  },
};

export const Escalated: Story = {
  args: {
    task: { ...BASE_TASK, status: 'escalated' },
    workforceMembers: MEMBERS,
  },
};

export const WithEvidenceAnchor: Story = {
  args: {
    task: {
      ...BASE_TASK,
      status: 'in-progress',
      assigneeId: 'wm-alice',
      evidenceAnchorId: 'ev-anchor-001',
    },
    workforceMembers: MEMBERS,
  },
};

export const MultipleCapabilities: Story = {
  args: {
    task: {
      ...BASE_TASK,
      requiredCapabilities: [
        'operations.approval',
        'operations.escalation',
        'robotics.supervision',
      ],
    },
    workforceMembers: MEMBERS,
  },
};

export const Closed: Story = {
  args: { task: BASE_TASK, open: false, workforceMembers: MEMBERS },
};

export const NullTask: Story = {
  args: { task: null, workforceMembers: MEMBERS },
};
