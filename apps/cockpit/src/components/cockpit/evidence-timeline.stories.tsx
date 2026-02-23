import type { Meta, StoryObj } from '@storybook/react';
import { EvidenceTimeline } from './evidence-timeline';
import type { EvidenceEntry } from '@portarium/cockpit-types';

const meta: Meta<typeof EvidenceTimeline> = {
  title: 'Cockpit/EvidenceTimeline',
  component: EvidenceTimeline,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof EvidenceTimeline>;

const ENTRIES: EvidenceEntry[] = [
  {
    schemaVersion: 1,
    evidenceId: 'ev-1',
    workspaceId: 'ws-1',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    category: 'Plan',
    summary: 'Execution plan generated with 3 effects',
    actor: { kind: 'System' },
    hashSha256: 'abc123',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-2',
    workspaceId: 'ws-1',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    category: 'Action',
    summary: 'Account created in Salesforce: acct-001',
    actor: { kind: 'Adapter', adapterId: 'salesforce-adapter' },
    previousHash: 'abc123',
    hashSha256: 'def456',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-3',
    workspaceId: 'ws-1',
    occurredAtIso: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    category: 'Approval',
    summary: 'Approval requested from user-alice',
    actor: { kind: 'User', userId: 'user-system' },
    previousHash: 'def456',
    hashSha256: 'ghi789',
  },
];

export const Default: Story = {
  args: { entries: ENTRIES },
};

export const Loading: Story = {
  args: { entries: [], loading: true },
};

export const Empty: Story = {
  args: { entries: [] },
};

export const SingleEntry: Story = {
  args: {
    entries: [
      {
        schemaVersion: 1,
        evidenceId: 'ev-single',
        workspaceId: 'ws-1',
        occurredAtIso: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        category: 'Policy',
        summary: 'Policy rule SOD-001 evaluated: eligible',
        actor: { kind: 'Machine', machineId: 'policy-engine-01' },
        hashSha256: 'xyz999',
      },
    ],
  },
};

export const ManyEntries: Story = {
  args: {
    entries: [
      ...ENTRIES,
      {
        schemaVersion: 1,
        evidenceId: 'ev-4',
        workspaceId: 'ws-1',
        occurredAtIso: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        category: 'PolicyViolation',
        summary: 'SoD rule triggered: requestor cannot approve own request',
        actor: { kind: 'System' },
        previousHash: 'ghi789',
        hashSha256: 'jkl012',
      },
      {
        schemaVersion: 1,
        evidenceId: 'ev-5',
        workspaceId: 'ws-1',
        occurredAtIso: new Date(Date.now() - 1000 * 30).toISOString(),
        category: 'System',
        summary: 'Run completed with status Succeeded',
        actor: { kind: 'System' },
        previousHash: 'jkl012',
        hashSha256: 'mno345',
      },
    ],
  },
};
