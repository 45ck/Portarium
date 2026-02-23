import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ApprovalGatePanel } from './approval-gate-panel';
import type { ApprovalSummary } from '@portarium/cockpit-types';

const meta: Meta<typeof ApprovalGatePanel> = {
  title: 'Cockpit/ApprovalGatePanel',
  component: ApprovalGatePanel,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { onDecide: fn() },
};
export default meta;

type Story = StoryObj<typeof ApprovalGatePanel>;

const BASE: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-001',
  workspaceId: 'ws-demo',
  runId: 'run-abc',
  planId: 'plan-xyz',
  prompt: 'Approve deployment of release v2.4.1 to production environment.',
  status: 'Pending',
  requestedAtIso: '2026-02-20T10:00:00.000Z',
  requestedByUserId: 'user-alice',
  assigneeUserId: 'user-bob',
  dueAtIso: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
};

export const Pending: Story = {
  args: { approval: BASE },
};

export const PendingLoading: Story = {
  args: { approval: BASE, loading: true },
};

export const SodBlockedSelf: Story = {
  args: {
    approval: {
      ...BASE,
      sodEvaluation: {
        state: 'blocked-self',
        requestorId: 'user-alice',
        ruleId: 'sod-rule-1',
        rolesRequired: ['approver'],
      },
    },
  },
};

export const SodBlockedRole: Story = {
  args: {
    approval: {
      ...BASE,
      sodEvaluation: {
        state: 'blocked-role',
        requestorId: 'user-bob',
        ruleId: 'sod-rule-2',
        rolesRequired: ['senior-approver'],
      },
    },
  },
};

export const Approved: Story = {
  args: {
    approval: {
      ...BASE,
      status: 'Approved',
      decidedByUserId: 'user-carol',
      decidedAtIso: '2026-02-20T11:30:00.000Z',
      rationale: 'All checks passed. Release notes reviewed and approved.',
    },
  },
};

export const Denied: Story = {
  args: {
    approval: {
      ...BASE,
      status: 'Denied',
      decidedByUserId: 'user-carol',
      decidedAtIso: '2026-02-20T11:00:00.000Z',
      rationale: 'Missing sign-off from QA team. Please resubmit after QA review.',
    },
  },
};

export const RequestChanges: Story = {
  args: {
    approval: {
      ...BASE,
      status: 'RequestChanges',
      decidedByUserId: 'user-dave',
      decidedAtIso: '2026-02-20T10:45:00.000Z',
      rationale: 'Update the rollback plan section before final approval.',
    },
  },
};

export const NoAssigneeOrDueDate: Story = {
  args: {
    approval: {
      ...BASE,
      assigneeUserId: undefined,
      dueAtIso: undefined,
    },
  },
};
