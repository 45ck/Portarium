import type { Meta, StoryObj } from '@storybook/react'
import { ApprovalGatePanel } from './ApprovalGatePanel'
import type { ApprovalSummary } from '@portarium/cockpit-types'

const baseApproval: ApprovalSummary = {
  schemaVersion: 1,
  approvalId: 'appr-001',
  workspaceId: 'ws-001',
  runId: 'run-001',
  planId: 'plan-001',
  prompt: 'Deploy v2.3.1 to production environment with updated RBAC policies?',
  status: 'Pending',
  requestedAtIso: '2026-02-20T10:00:00Z',
  requestedByUserId: 'user-alice',
  assigneeUserId: 'user-bob',
  dueAtIso: '2026-02-21T10:00:00Z',
}

const meta: Meta<typeof ApprovalGatePanel> = {
  title: 'Cockpit/ApprovalGatePanel',
  component: ApprovalGatePanel,
  args: {
    onDecide: (decision, rationale) =>
      console.log('Decision:', decision, 'Rationale:', rationale),
  },
}
export default meta
type Story = StoryObj<typeof ApprovalGatePanel>

export const Pending: Story = {
  args: {
    approval: baseApproval,
  },
}

export const PendingValid: Story = {
  args: {
    approval: baseApproval,
  },
  render: (args) => <ApprovalGatePanel {...args} />,
  parameters: {
    docs: {
      description: {
        story: 'Enter 20+ characters in the rationale field to enable the decision buttons.',
      },
    },
  },
}

export const Approved: Story = {
  args: {
    approval: {
      ...baseApproval,
      status: 'Approved',
      decidedAtIso: '2026-02-20T12:00:00Z',
      decidedByUserId: 'user-bob',
      rationale: 'Reviewed the RBAC policies and deployment plan. All checks pass, proceeding with deployment.',
    },
  },
}

export const Denied: Story = {
  args: {
    approval: {
      ...baseApproval,
      status: 'Denied',
      decidedAtIso: '2026-02-20T12:00:00Z',
      decidedByUserId: 'user-bob',
      rationale: 'The RBAC policy changes have not been reviewed by the security team yet.',
    },
  },
}

export const RequestChanges: Story = {
  args: {
    approval: {
      ...baseApproval,
      status: 'RequestChanges',
      decidedAtIso: '2026-02-20T12:00:00Z',
      decidedByUserId: 'user-bob',
      rationale: 'Please add rollback procedures and update the deployment checklist before proceeding.',
    },
  },
}
