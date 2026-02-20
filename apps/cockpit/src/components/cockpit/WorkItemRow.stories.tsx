import type { Meta, StoryObj } from '@storybook/react'
import { WorkItemRow } from './WorkItemRow'
import type { WorkItemSummary } from '@portarium/cockpit-types'

const meta: Meta<typeof WorkItemRow> = {
  title: 'Cockpit/WorkItemRow',
  component: WorkItemRow,
}
export default meta
type Story = StoryObj<typeof WorkItemRow>

const baseItem: WorkItemSummary = {
  schemaVersion: 1,
  workItemId: 'wi-001',
  workspaceId: 'ws-001',
  createdAtIso: '2026-02-18T10:00:00Z',
  createdByUserId: 'user-alice',
  title: 'Invoice mismatch on PO-4421',
  status: 'Open',
  ownerUserId: 'user-bob',
}

export const WithOdooRef: Story = {
  args: {
    workItem: {
      ...baseItem,
      links: {
        externalRefs: [
          {
            sorName: 'Odoo',
            portFamily: 'erp',
            externalId: 'INV-2024-0042',
            externalType: 'invoice',
            displayLabel: 'Invoice #0042',
          },
        ],
      },
    },
    onOpen: () => {},
  },
}

export const WithSla: Story = {
  args: {
    workItem: {
      ...baseItem,
      sla: { dueAtIso: '2026-02-25T17:00:00Z' },
    },
    onOpen: () => {},
  },
}

export const Overdue: Story = {
  args: {
    workItem: {
      ...baseItem,
      sla: { dueAtIso: '2026-02-15T17:00:00Z' },
    },
    onOpen: () => {},
  },
}

export const Closed: Story = {
  args: {
    workItem: {
      ...baseItem,
      status: 'Closed',
    },
    onOpen: () => {},
  },
}

export const Minimal: Story = {
  args: {
    workItem: {
      schemaVersion: 1,
      workItemId: 'wi-002',
      workspaceId: 'ws-001',
      createdAtIso: '2026-02-19T08:00:00Z',
      createdByUserId: 'user-charlie',
      title: 'Simple work item',
      status: 'Open',
    },
    onOpen: () => {},
  },
}
