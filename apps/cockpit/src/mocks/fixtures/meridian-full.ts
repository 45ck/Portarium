// ---------------------------------------------------------------------------
// Meridian Cold Chain Logistics — Full dataset (~6 months: Jul–Dec 2025)
// ---------------------------------------------------------------------------
import { generateMeridianDataset } from './meridian-seed';

const dataset = generateMeridianDataset({
  seed: 7919,
  startIso: '2025-07-01T00:00:00Z',
  endIso: '2025-12-31T23:59:59Z',
  workItemCount: 80,
  runCount: 300,
  approvalCount: 150,
  evidenceCount: 1200,
  memberCount: 12,
  queueCount: 6,
  agentCount: 10,
  adapterCount: 15,
  robotCount: 28,
  missionCount: 40,
});

export const WORK_ITEMS = dataset.WORK_ITEMS;
export const RUNS = dataset.RUNS;
export const APPROVALS = dataset.APPROVALS;
export const PLANS = dataset.PLANS;
export const CREDENTIAL_GRANTS = dataset.CREDENTIAL_GRANTS;
export const EVIDENCE = dataset.EVIDENCE;
export const WORKFORCE_MEMBERS = dataset.WORKFORCE_MEMBERS;
export const WORKFORCE_QUEUES = dataset.WORKFORCE_QUEUES;
export const AGENTS = dataset.AGENTS;
export const MACHINES = dataset.MACHINES;
export const ADAPTERS = dataset.ADAPTERS;
export const ROBOTS = dataset.ROBOTS;
export const MISSIONS = dataset.MISSIONS;
export const SAFETY_CONSTRAINTS = dataset.SAFETY_CONSTRAINTS;
export const APPROVAL_THRESHOLDS = dataset.APPROVAL_THRESHOLDS;
export const ESTOP_AUDIT_LOG = dataset.ESTOP_AUDIT_LOG;
export const OBSERVABILITY_DATA = dataset.OBSERVABILITY_DATA;
