// ---------------------------------------------------------------------------
// Fixture index — dataset switcher
// ---------------------------------------------------------------------------

import type { MockCockpitDataset } from './dataset';
import type { DatasetId } from '@/lib/cockpit-runtime';

export type { DatasetId } from '@/lib/cockpit-runtime';

export interface DatasetEntry {
  id: DatasetId;
  label: string;
  description: string;
  load: () => Promise<MockCockpitDataset>;
}

/**
 * Registry of available mock datasets.
 * Each entry lazy-loads its module so only the active dataset occupies memory.
 */
export const DATASETS: DatasetEntry[] = [
  {
    id: 'live',
    label: 'Live',
    description: 'Live mode — uses the real API (no mock data)',
    load: () =>
      Promise.resolve({
        WORK_ITEMS: [],
        RUNS: [],
        APPROVALS: [],
        PLANS: [],
        CREDENTIAL_GRANTS: [],
        EVIDENCE: [],
        WORKFORCE_MEMBERS: [],
        WORKFORCE_QUEUES: [],
        AGENTS: [],
        MACHINES: [],
        ADAPTERS: [],
        ROBOTS: [],
        MISSIONS: [],
        SAFETY_CONSTRAINTS: [],
        APPROVAL_THRESHOLDS: [],
        ESTOP_AUDIT_LOG: [],
        OBSERVABILITY_DATA: { runsOverTime: [], successRate: 0, avgSlaDays: 0 },
      }),
  },
  {
    id: 'platform-showcase',
    label: 'Portarium Platform Showcase',
    description: 'Generic control-plane snapshot for operator, approval, evidence, and adapter flows',
    load: () =>
      import('./platform-showcase').then((m) => ({
        WORK_ITEMS: m.WORK_ITEMS,
        RUNS: m.RUNS,
        APPROVALS: m.APPROVALS,
        PLANS: m.PLANS,
        CREDENTIAL_GRANTS: m.CREDENTIAL_GRANTS,
        EVIDENCE: m.EVIDENCE,
        WORKFORCE_MEMBERS: m.WORKFORCE_MEMBERS,
        WORKFORCE_QUEUES: m.WORKFORCE_QUEUES,
        AGENTS: m.AGENTS,
        MACHINES: m.MACHINES,
        ADAPTERS: m.ADAPTERS,
        ROBOTS: m.ROBOTS,
        MISSIONS: m.MISSIONS,
        SAFETY_CONSTRAINTS: m.SAFETY_CONSTRAINTS,
        APPROVAL_THRESHOLDS: m.APPROVAL_THRESHOLDS,
        ESTOP_AUDIT_LOG: m.ESTOP_AUDIT_LOG,
        OBSERVABILITY_DATA: m.OBSERVABILITY_DATA,
      })),
  },
];

export const DEFAULT_DATASET_ID: DatasetId = 'platform-showcase';
