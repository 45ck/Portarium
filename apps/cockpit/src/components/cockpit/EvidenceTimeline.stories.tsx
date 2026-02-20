import type { Meta, StoryObj } from '@storybook/react'
import { EvidenceTimeline } from './EvidenceTimeline'
import type { EvidenceEntry } from '@portarium/cockpit-types'

const meta: Meta<typeof EvidenceTimeline> = {
  title: 'Cockpit/EvidenceTimeline',
  component: EvidenceTimeline,
}
export default meta
type Story = StoryObj<typeof EvidenceTimeline>

const chain: EvidenceEntry[] = [
  {
    schemaVersion: 1,
    evidenceId: 'ev-001',
    workspaceId: 'ws-001',
    occurredAtIso: '2026-02-20T09:00:00Z',
    category: 'Plan',
    summary: 'Reconciliation plan created for invoice mismatch on PO-4421',
    actor: { kind: 'Machine', machineId: 'agent-recon-01' },
    hashSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-002',
    workspaceId: 'ws-001',
    occurredAtIso: '2026-02-20T09:15:00Z',
    category: 'Approval',
    summary: 'Finance lead approved correction of line amount',
    actor: { kind: 'User', userId: 'user-bob' },
    previousHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    hashSha256: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-003',
    workspaceId: 'ws-001',
    occurredAtIso: '2026-02-20T09:20:00Z',
    category: 'Action',
    summary: 'Invoice line amount corrected from 250 to 225 in Odoo',
    actor: { kind: 'Adapter', adapterId: 'adapter-odoo-01' },
    previousHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    hashSha256: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  },
]

export const ReconciliationChain: Story = {
  args: { entries: chain },
}

export const SingleEntry: Story = {
  args: { entries: chain.slice(0, 1) },
}

export const Empty: Story = {
  args: { entries: [] },
}
