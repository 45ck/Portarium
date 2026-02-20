import type { Meta, StoryObj } from '@storybook/react';
import { EvidenceTimeline } from '@/components/cockpit/evidence-timeline';
import type { EvidenceEntry } from '@portarium/cockpit-types';

const meta: Meta<typeof EvidenceTimeline> = {
  title: 'Cockpit/EvidenceTimeline',
  component: EvidenceTimeline,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof EvidenceTimeline>;

const sampleEntries: EvidenceEntry[] = [
  {
    schemaVersion: 1,
    evidenceId: 'ev-001',
    workspaceId: 'ws-demo',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    category: 'Action',
    summary: 'Provisioned VM instance in us-east-1',
    actor: { kind: 'Machine', machineId: 'agent-infra-01' },
    hashSha256: 'abc123',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-002',
    workspaceId: 'ws-demo',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    category: 'Approval',
    summary: 'Manager approved production deployment',
    actor: { kind: 'User', userId: 'user-jane' },
    previousHash: 'abc123',
    hashSha256: 'def456',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-003',
    workspaceId: 'ws-demo',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    category: 'Plan',
    summary: 'Generated deployment plan for service-api v2.1.0',
    actor: { kind: 'Machine', machineId: 'agent-planner' },
    previousHash: 'def456',
    hashSha256: 'ghi789',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-004',
    workspaceId: 'ws-demo',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    category: 'System',
    summary: 'Workspace health check passed',
    actor: { kind: 'System' },
    previousHash: 'ghi789',
    hashSha256: 'jkl012',
  },
];

export const Default: Story = {
  args: {
    entries: sampleEntries,
  },
};

export const Loading: Story = {
  args: {
    entries: [],
    loading: true,
  },
};
