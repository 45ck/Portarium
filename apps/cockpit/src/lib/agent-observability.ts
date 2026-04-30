import type {
  AgentV1,
  ApprovalSummary,
  EvidenceEntry,
  HumanTaskSummary,
  MachineV1,
  RunSummary,
  WorkforceQueueSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';

export type EvidenceChainHealth = 'intact' | 'gaps' | 'empty';
export type AgentSessionPosture = 'active' | 'waiting' | 'idle' | 'attention';

export interface AgentSessionObservation {
  sessionId: string;
  agent: AgentV1;
  machine?: MachineV1;
  run?: RunSummary;
  activeRuns: RunSummary[];
  pendingApprovals: ApprovalSummary[];
  latestEvidence?: EvidenceEntry;
  toolActivityCount: number;
  latestToolName?: string;
  queueNames: string[];
  posture: AgentSessionPosture;
}

export interface AgentObservabilityModel {
  sessions: AgentSessionObservation[];
  activeRuns: RunSummary[];
  pendingApprovals: ApprovalSummary[];
  actionableHumanTasks: HumanTaskSummary[];
  openWorkItems: WorkItemSummary[];
  evidenceChainHealth: EvidenceChainHealth;
  evidenceBreakCount: number;
  toolActivityCount: number;
}

export const ACTIVE_RUN_STATUSES = new Set<RunSummary['status']>([
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
]);

const ACTIONABLE_TASK_STATUSES = new Set<HumanTaskSummary['status']>([
  'pending',
  'assigned',
  'in-progress',
  'escalated',
]);

function sortNewestFirst<
  T extends { occurredAtIso?: string; requestedAtIso?: string; createdAtIso?: string },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = a.occurredAtIso ?? a.requestedAtIso ?? a.createdAtIso ?? '';
    const right = b.occurredAtIso ?? b.requestedAtIso ?? b.createdAtIso ?? '';
    return right.localeCompare(left);
  });
}

function inWorkspace<T extends { workspaceId?: string }>(workspaceId: string, items: T[]): T[] {
  return items.filter((item) => item.workspaceId === workspaceId);
}

export function summarizeEvidenceChain(evidence: EvidenceEntry[]): {
  health: EvidenceChainHealth;
  breakCount: number;
} {
  if (evidence.length === 0) return { health: 'empty', breakCount: 0 };

  const byRun = new Map<string, EvidenceEntry[]>();
  for (const entry of evidence) {
    const runId = entry.links?.runId ?? '__workspace__';
    byRun.set(runId, [...(byRun.get(runId) ?? []), entry]);
  }

  let breakCount = 0;
  for (const entries of byRun.values()) {
    const ordered = [...entries].sort((a, b) => a.occurredAtIso.localeCompare(b.occurredAtIso));
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (
        current?.previousHash &&
        previous?.hashSha256 &&
        current.previousHash !== previous.hashSha256
      ) {
        breakCount += 1;
      }
    }
  }

  return { health: breakCount > 0 ? 'gaps' : 'intact', breakCount };
}

export function buildAgentObservabilityModel(input: {
  workspaceId: string;
  agents: AgentV1[];
  machines: MachineV1[];
  runs: RunSummary[];
  approvals: ApprovalSummary[];
  evidence: EvidenceEntry[];
  humanTasks: HumanTaskSummary[];
  workItems: WorkItemSummary[];
  queues: WorkforceQueueSummary[];
}): AgentObservabilityModel {
  const agents = inWorkspace(input.workspaceId, input.agents);
  const machines = inWorkspace(input.workspaceId, input.machines);
  const runs = inWorkspace(input.workspaceId, input.runs);
  const approvals = inWorkspace(input.workspaceId, input.approvals);
  const evidence = inWorkspace(input.workspaceId, input.evidence);
  const workItems = inWorkspace(input.workspaceId, input.workItems);
  const queues = input.queues;

  const activeRuns = runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status));
  const pendingApprovals = approvals.filter((approval) => approval.status === 'Pending');
  const actionableHumanTasks = input.humanTasks.filter((task) => {
    if (!ACTIONABLE_TASK_STATUSES.has(task.status)) return false;
    return activeRuns.some((run) => run.runId === task.runId);
  });
  const openWorkItems = workItems.filter((item) => item.status !== 'Closed');
  const evidenceNewest = sortNewestFirst(evidence);
  const chain = summarizeEvidenceChain(evidence);

  const activeSessionAgentIds = new Set<string>();
  const activeSessions = activeRuns.flatMap((run) => {
    const runAgents = agents.filter((agent) => run.agentIds?.includes(agent.agentId));
    return runAgents.map((agent) => {
      activeSessionAgentIds.add(agent.agentId);
      const relatedRuns = [run];
      const relatedApprovals = pendingApprovals.filter(
        (approval) =>
          approval.runId === run.runId &&
          (!approval.agentActionProposal || approval.agentActionProposal.agentId === agent.agentId),
      );
      const linkedEvidence = evidenceNewest.filter((entry) => entry.links?.runId === run.runId);
      const toolApprovals = approvals.filter(
        (approval) =>
          approval.runId === run.runId && approval.agentActionProposal?.agentId === agent.agentId,
      );
      const queueNames = queues
        .filter((queue) => run.operatorOwnerId === queue.workforceQueueId)
        .map((queue) => queue.name);
      const posture =
        relatedApprovals.length > 0
          ? 'waiting'
          : run.status === 'Paused' || run.controlState === 'blocked'
            ? 'attention'
            : 'active';

      return {
        sessionId: `${input.workspaceId}:${run.runId}:${agent.agentId}`,
        agent,
        machine: machines.find((machine) => machine.machineId === agent.machineId),
        run,
        activeRuns: relatedRuns,
        pendingApprovals: relatedApprovals,
        latestEvidence: linkedEvidence[0],
        toolActivityCount: toolApprovals.length,
        latestToolName: toolApprovals[0]?.agentActionProposal?.toolName,
        queueNames,
        posture,
      } satisfies AgentSessionObservation;
    });
  });

  const idleSessions = agents
    .filter((agent) => !activeSessionAgentIds.has(agent.agentId))
    .map((agent) => {
      const relatedApprovals = pendingApprovals.filter(
        (approval) => approval.agentActionProposal?.agentId === agent.agentId,
      );
      const toolApprovals = approvals.filter(
        (approval) => approval.agentActionProposal?.agentId === agent.agentId,
      );

      return {
        sessionId: `${input.workspaceId}:idle:${agent.agentId}`,
        agent,
        machine: machines.find((machine) => machine.machineId === agent.machineId),
        activeRuns: [],
        pendingApprovals: relatedApprovals,
        toolActivityCount: toolApprovals.length,
        latestToolName: toolApprovals[0]?.agentActionProposal?.toolName,
        queueNames: [],
        posture: relatedApprovals.length > 0 ? 'waiting' : 'idle',
      } satisfies AgentSessionObservation;
    });

  return {
    sessions: [...activeSessions, ...idleSessions],
    activeRuns,
    pendingApprovals,
    actionableHumanTasks,
    openWorkItems,
    evidenceChainHealth: chain.health,
    evidenceBreakCount: chain.breakCount,
    toolActivityCount: approvals.filter((approval) => approval.agentActionProposal).length,
  };
}
