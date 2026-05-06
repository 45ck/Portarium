import type {
  AdapterSummary,
  AgentV1,
  ApprovalCoverageRosterSummary,
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

export interface MockCockpitDataset {
  WORK_ITEMS: WorkItemSummary[];
  RUNS: RunSummary[];
  APPROVALS: ApprovalSummary[];
  PLANS: Plan[];
  CREDENTIAL_GRANTS: CredentialGrantV1[];
  EVIDENCE: EvidenceEntry[];
  WORKFORCE_MEMBERS: WorkforceMemberSummary[];
  WORKFORCE_QUEUES: WorkforceQueueSummary[];
  APPROVAL_COVERAGE_ROSTER?: ApprovalCoverageRosterSummary;
  AGENTS: AgentV1[];
  MACHINES: MachineV1[];
  ADAPTERS: AdapterSummary[];
  ROBOTS: RobotSummary[];
  MISSIONS: MissionSummary[];
  SAFETY_CONSTRAINTS: SafetyConstraint[];
  APPROVAL_THRESHOLDS: ApprovalThreshold[];
  ESTOP_AUDIT_LOG: EStopAuditEntry[];
  OBSERVABILITY_DATA: {
    runsOverTime: { date: string; succeeded: number; failed: number; waitingForApproval: number }[];
    successRate: number;
    avgSlaDays: number;
  };
}
