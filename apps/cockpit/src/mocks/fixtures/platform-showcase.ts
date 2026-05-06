import type {
  AdapterSummary,
  AgentV1,
  ApprovalSummary,
  CredentialGrantV1,
  EvidenceEntry,
  MachineV1,
  Plan,
  RunSummary,
  WorkforceMemberSummary,
  WorkforceQueueSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';
import type {
  ApprovalThreshold,
  EStopAuditEntry,
  MissionSummary,
  RobotSummary,
  SafetyConstraint,
} from '@/types/robotics';
import {
  ADAPTERS as DEMO_ADAPTERS,
  AGENTS as DEMO_AGENTS,
  APPROVALS as DEMO_APPROVALS,
  CREDENTIAL_GRANTS as DEMO_CREDENTIAL_GRANTS,
  EVIDENCE as DEMO_EVIDENCE,
  MACHINES as DEMO_MACHINES,
  OBSERVABILITY_DATA as DEMO_OBSERVABILITY_DATA,
  PLANS as DEMO_PLANS,
  RUNS as DEMO_RUNS,
  WORKFORCE_MEMBERS as DEMO_WORKFORCE_MEMBERS,
  WORKFORCE_QUEUES as DEMO_WORKFORCE_QUEUES,
  WORK_ITEMS as DEMO_WORK_ITEMS,
} from './demo';

const WORKSPACE_ID = 'ws-platform-showcase';
const TENANT_ID = 'tenant-platform-showcase';

function withWorkspace<T extends { workspaceId: string }>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item, workspaceId: WORKSPACE_ID }));
}

function withTenant<T extends { tenantId: string }>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item, tenantId: TENANT_ID }));
}

export const WORK_ITEMS: WorkItemSummary[] = withWorkspace(DEMO_WORK_ITEMS);
export const RUNS: RunSummary[] = withWorkspace(DEMO_RUNS);
export const APPROVALS: ApprovalSummary[] = withWorkspace(DEMO_APPROVALS);
export const PLANS: Plan[] = withWorkspace(DEMO_PLANS);
export const EVIDENCE: EvidenceEntry[] = withWorkspace(DEMO_EVIDENCE);
export const WORKFORCE_MEMBERS: WorkforceMemberSummary[] = withTenant(DEMO_WORKFORCE_MEMBERS);
export const WORKFORCE_QUEUES: WorkforceQueueSummary[] = withTenant(DEMO_WORKFORCE_QUEUES);
export const AGENTS: AgentV1[] = withWorkspace(
  DEMO_AGENTS.filter((agent) => !agent.agentId.includes('openclaw')),
);
export const MACHINES: MachineV1[] = withWorkspace(DEMO_MACHINES);
export const ADAPTERS: AdapterSummary[] = DEMO_ADAPTERS.map((adapter) => ({ ...adapter }));
export const CREDENTIAL_GRANTS: CredentialGrantV1[] = withWorkspace(DEMO_CREDENTIAL_GRANTS).map(
  (grant) => ({
    ...grant,
    credentialsRef: grant.credentialsRef.replace('vault://ws-demo', `vault://${WORKSPACE_ID}`),
  }),
);

export const ROBOTS: RobotSummary[] = [];
export const MISSIONS: MissionSummary[] = [];
export const SAFETY_CONSTRAINTS: SafetyConstraint[] = [];
export const APPROVAL_THRESHOLDS: ApprovalThreshold[] = [];
export const ESTOP_AUDIT_LOG: EStopAuditEntry[] = [];

export const OBSERVABILITY_DATA = {
  ...DEMO_OBSERVABILITY_DATA,
  runsOverTime: DEMO_OBSERVABILITY_DATA.runsOverTime.map((point) => ({ ...point })),
};
