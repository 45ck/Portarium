import type { ApprovalSummary, RunSummary, WorkItemSummary } from '@portarium/cockpit-types';

export type EngineeringBeadColumnId = 'Ready' | 'Running' | 'AwaitingApproval' | 'Done';
export type BlastRadiusLevel = 'low' | 'medium' | 'high' | 'critical';

export interface EngineeringBead {
  beadId: string;
  title: string;
  column: EngineeringBeadColumnId;
  workItemStatus: WorkItemSummary['status'];
  ownerUserId?: string;
  dueAtIso?: string;
  runIds: string[];
  approvalIds: string[];
  evidenceCount: number;
  primaryRun?: RunSummary;
  primaryApproval?: ApprovalSummary;
  policyTier: RunSummary['executionTier'];
  blastRadius: BlastRadiusLevel;
  lastActivityIso: string;
}

const EXECUTION_TIERS = ['Auto', 'Assisted', 'HumanApprove', 'ManualOnly'] as const;
const TERMINAL_RUN_STATUS: ReadonlySet<RunSummary['status']> = new Set([
  'Succeeded',
  'Failed',
  'Cancelled',
]);

function isExecutionTier(value: string | undefined): value is RunSummary['executionTier'] {
  return EXECUTION_TIERS.includes(value as RunSummary['executionTier']);
}

function newestIso(values: Array<string | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
}

function selectPrimaryRun(runs: RunSummary[]): RunSummary | undefined {
  return [...runs].sort((a, b) => {
    const aActive = TERMINAL_RUN_STATUS.has(a.status) ? 0 : 1;
    const bActive = TERMINAL_RUN_STATUS.has(b.status) ? 0 : 1;
    if (aActive !== bActive) return bActive - aActive;
    return Date.parse(b.createdAtIso) - Date.parse(a.createdAtIso);
  })[0];
}

function selectPrimaryApproval(approvals: ApprovalSummary[]): ApprovalSummary | undefined {
  return [...approvals].sort((a, b) => {
    const aPending = a.status === 'Pending' ? 1 : 0;
    const bPending = b.status === 'Pending' ? 1 : 0;
    if (aPending !== bPending) return bPending - aPending;
    return Date.parse(b.requestedAtIso) - Date.parse(a.requestedAtIso);
  })[0];
}

function columnFor(
  item: WorkItemSummary,
  runs: RunSummary[],
  approvals: ApprovalSummary[],
): EngineeringBeadColumnId {
  if (item.status === 'Closed' || item.status === 'Resolved') return 'Done';
  if (approvals.some((approval) => approval.status === 'Pending')) return 'AwaitingApproval';
  if (runs.some((run) => run.status === 'WaitingForApproval' || run.status === 'Paused')) {
    return 'AwaitingApproval';
  }
  if (runs.some((run) => run.status === 'Running' || run.status === 'Pending')) return 'Running';
  if (runs.length > 0 && runs.every((run) => TERMINAL_RUN_STATUS.has(run.status))) return 'Done';
  return 'Ready';
}

function tierFor(approval: ApprovalSummary | undefined, run: RunSummary | undefined) {
  const policyTier = approval?.policyRule?.tier;
  if (isExecutionTier(policyTier)) return policyTier;
  const proposalTier = approval?.agentActionProposal?.blastRadiusTier;
  if (isExecutionTier(proposalTier)) return proposalTier;
  return run?.executionTier ?? 'Auto';
}

function blastRadiusFor(
  approval: ApprovalSummary | undefined,
  tier: RunSummary['executionTier'],
): BlastRadiusLevel {
  if (tier === 'ManualOnly' || approval?.policyRule?.irreversibility === 'full') return 'critical';
  if (tier === 'HumanApprove') return 'high';
  if ((approval?.policyRule?.blastRadius.length ?? 0) > 0 || tier === 'Assisted') return 'medium';
  return 'low';
}

export function buildEngineeringBeads(input: {
  workItems: WorkItemSummary[];
  runs: RunSummary[];
  approvals: ApprovalSummary[];
}): EngineeringBead[] {
  const runsById = new Map(input.runs.map((run) => [run.runId, run]));
  const approvalsById = new Map(input.approvals.map((approval) => [approval.approvalId, approval]));

  return input.workItems
    .map((item) => {
      const linkedRunIds = new Set(item.links?.runIds ?? []);
      const linkedApprovalIds = new Set(item.links?.approvalIds ?? []);

      for (const approval of input.approvals) {
        if (approval.workItemId === item.workItemId) linkedApprovalIds.add(approval.approvalId);
        if (linkedRunIds.has(approval.runId)) linkedApprovalIds.add(approval.approvalId);
      }

      const runs = [...linkedRunIds]
        .map((runId) => runsById.get(runId))
        .filter((run): run is RunSummary => Boolean(run));
      const approvals = [...linkedApprovalIds]
        .map((approvalId) => approvalsById.get(approvalId))
        .filter((approval): approval is ApprovalSummary => Boolean(approval));
      const primaryRun = selectPrimaryRun(runs);
      const primaryApproval = selectPrimaryApproval(approvals);
      const policyTier = tierFor(primaryApproval, primaryRun);

      return {
        beadId: item.workItemId,
        title: item.title,
        column: columnFor(item, runs, approvals),
        workItemStatus: item.status,
        ...(item.ownerUserId ? { ownerUserId: item.ownerUserId } : {}),
        ...(item.sla?.dueAtIso ? { dueAtIso: item.sla.dueAtIso } : {}),
        runIds: [...linkedRunIds],
        approvalIds: [...linkedApprovalIds],
        evidenceCount: item.links?.evidenceIds?.length ?? 0,
        ...(primaryRun ? { primaryRun } : {}),
        ...(primaryApproval ? { primaryApproval } : {}),
        policyTier,
        blastRadius: blastRadiusFor(primaryApproval, policyTier),
        lastActivityIso: newestIso([
          item.createdAtIso,
          primaryRun?.endedAtIso,
          primaryRun?.startedAtIso,
          primaryRun?.createdAtIso,
          primaryApproval?.decidedAtIso,
          primaryApproval?.requestedAtIso,
        ]),
      };
    })
    .sort((a, b) => Date.parse(b.lastActivityIso) - Date.parse(a.lastActivityIso));
}

export const ENGINEERING_BEAD_COLUMNS: Array<{
  id: EngineeringBeadColumnId;
  title: string;
  description: string;
}> = [
  { id: 'Ready', title: 'Ready', description: 'Scoped and idle' },
  { id: 'Running', title: 'Running', description: 'Agent work in flight' },
  { id: 'AwaitingApproval', title: 'Awaiting Approval', description: 'Human decision needed' },
  { id: 'Done', title: 'Done', description: 'Closed or terminal' },
];
