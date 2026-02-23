// ---------------------------------------------------------------------------
// Fixture index — dataset switcher
// ---------------------------------------------------------------------------

import type { MeridianDataset } from './meridian-seed';

export type DatasetId = 'demo' | 'meridian-demo' | 'meridian-full';

export interface DatasetEntry {
  id: DatasetId;
  label: string;
  description: string;
  load: () => Promise<MeridianDataset>;
}

/**
 * Registry of available demo datasets.
 * Each entry lazy-loads its module so only the active dataset occupies memory.
 */
export const DATASETS: DatasetEntry[] = [
  {
    id: 'demo',
    label: 'Portarium Demo',
    description: 'Small generic demo (6 work items, 7 runs)',
    load: () =>
      import('./demo').then((m) => ({
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
  {
    id: 'meridian-demo',
    label: 'Meridian Cold Chain (Demo)',
    description: 'Pharma cold-chain — 3 months, 50 runs, 15 robots',
    load: () =>
      import('./meridian-demo').then((m) => ({
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
  {
    id: 'meridian-full',
    label: 'Meridian Cold Chain (Full)',
    description: 'Pharma cold-chain — 6 months, 300 runs, 28 robots, 1200 evidence',
    load: () =>
      import('./meridian-full').then((m) => ({
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

export const DEFAULT_DATASET_ID: DatasetId = 'demo';
