import type { Meta, StoryObj } from '@storybook/react'
import { WorkItemCard } from './WorkItemCard'
import type { WorkItemSummary } from '@portarium/cockpit-types'

const meta: Meta<typeof WorkItemCard> = {
  title: 'Cockpit/WorkItemCard',
  component: WorkItemCard,
}
export default meta
type Story = StoryObj<typeof WorkItemCard>

const fullItem: WorkItemSummary = {
  schemaVersion: 1,
  workItemId: 'wi-001',
  workspaceId: 'ws-001',
  createdAtIso: '2026-02-18T10:00:00Z',
  createdByUserId: 'user-alice',
  title: 'Invoice mismatch on PO-4421',
  status: 'Open',
  ownerUserId: 'user-bob',
  sla: { dueAtIso: '2026-02-25T17:00:00Z' },
  links: {
    externalRefs: [
      {
        sorName: 'Odoo',
        portFamily: 'erp',
        externalId: 'INV-2024-0042',
        externalType: 'invoice',
        displayLabel: 'Invoice #0042',
      },
      {
        sorName: 'SAP',
        portFamily: 'erp',
        externalId: 'PO-4421',
        externalType: 'purchase_order',
        displayLabel: 'PO #4421',
      },
    ],
    runIds: ['run-001', 'run-002'],
    approvalIds: ['appr-001'],
    evidenceIds: ['ev-001', 'ev-002', 'ev-003'],
  },
}

export const InvoiceMismatch: Story = {
  args: { workItem: fullItem },
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
  },
}

export const WithSla: Story = {
  args: {
    workItem: {
      ...fullItem,
      links: undefined,
      sla: { dueAtIso: '2026-02-15T17:00:00Z' },
    },
  },
}
