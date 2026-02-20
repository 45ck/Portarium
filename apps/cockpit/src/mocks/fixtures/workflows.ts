import type { AgentV1, RunSummary, WorkflowSummary } from '@portarium/cockpit-types';

const TRIGGER_KINDS: WorkflowSummary['triggerKind'][] = [
  'Manual',
  'Cron',
  'Webhook',
  'DomainEvent',
];

const WORKFLOW_PORT_FAMILY: Record<string, string> = {
  'wf-order-fulfillment': 'LogisticsShipping',
  'wf-qc-approval': 'RegulatoryCompliance',
  'wf-maintenance-window': 'IoTTelemetry',
  'wf-incident-report': 'Itsm',
  'wf-supplier-invoice': 'FinanceAccounting',
  'wf-cold-chain-deviation': 'IoTTelemetry',
  'wf-controlled-substance-audit': 'RegulatoryCompliance',
};

export function buildMockWorkflows(
  runs: readonly RunSummary[],
  agents: readonly AgentV1[],
): WorkflowSummary[] {
  const workflowIds = Array.from(new Set(runs.map((run) => run.workflowId))).sort((a, b) =>
    a.localeCompare(b),
  );

  return workflowIds.map((workflowId, index) => {
    const workflowRuns = runs.filter((run) => run.workflowId === workflowId);
    const latestRun = workflowRuns
      .slice()
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))[0];

    const linkedAgentIds = Array.from(
      new Set(
        agents
          .filter((agent) => (agent.usedByWorkflowIds ?? []).includes(workflowId))
          .map((agent) => agent.agentId),
      ),
    );
    const primaryAgent = linkedAgentIds[0] ?? `agent-${index + 1}`;

    const actionCount = 3 + (index % 3);
    const actions = Array.from({ length: actionCount }, (_, actionIndex) => ({
      actionId: `${workflowId}-action-${actionIndex + 1}`,
      order: actionIndex + 1,
      portFamily: WORKFLOW_PORT_FAMILY[workflowId] ?? 'Itsm',
      operation:
        actionIndex === 0
          ? 'agent:task'
          : actionIndex === actionCount - 1
            ? 'workflow:finalize'
            : `workflow:step-${actionIndex + 1}-${primaryAgent}`,
    }));

    return {
      schemaVersion: 1,
      workflowId,
      workspaceId: latestRun?.workspaceId ?? 'ws-demo',
      name: humanizeWorkflowId(workflowId),
      description: `Workflow definition for ${humanizeWorkflowId(workflowId)}.`,
      version: 1 + (index % 4),
      active: workflowRuns.some((run) => run.status !== 'Succeeded' && run.status !== 'Cancelled'),
      executionTier: latestRun?.executionTier ?? 'Auto',
      actions,
      triggerKind: TRIGGER_KINDS[index % TRIGGER_KINDS.length],
      timeoutMs: 300_000,
      retryPolicy: {
        maxAttempts: 3,
        initialBackoffMs: 1_000,
        maxBackoffMs: 30_000,
        backoffMultiplier: 2,
      },
      compensationMode: 'best-effort',
    } satisfies WorkflowSummary;
  });
}

export function findMockWorkflowById(
  runs: readonly RunSummary[],
  agents: readonly AgentV1[],
  workflowId: string,
): WorkflowSummary | null {
  return (
    buildMockWorkflows(runs, agents).find((workflow) => workflow.workflowId === workflowId) ?? null
  );
}

function humanizeWorkflowId(workflowId: string): string {
  return workflowId
    .replace(/^wf-/, '')
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1)))
    .join(' ');
}
