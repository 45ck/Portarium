import type {
  ApprovalSummary,
  EvidenceEntry,
  ProjectSummary,
  RunSummary,
  WorkItemSummary,
} from '@portarium/cockpit-types';

const ACTIVE_RUN_STATUSES = new Set<RunSummary['status']>([
  'Pending',
  'Running',
  'WaitingForApproval',
  'Paused',
]);

type ProjectDefinition = Readonly<{
  projectId: string;
  name: string;
  summary: string;
  ownerUserIds: readonly string[];
  policyIds: readonly string[];
  defaultExecutionTier: RunSummary['executionTier'];
  evidenceDepth: ProjectSummary['governance']['evidenceDepth'];
  allowedActionClasses: readonly string[];
  blockedActionClasses: readonly string[];
  portFamilies: readonly string[];
  workflowHints: readonly string[];
}>;

const PROJECT_DEFINITIONS: readonly ProjectDefinition[] = [
  {
    projectId: 'proj-finance-controls',
    name: 'Finance Controls',
    summary: 'Invoice remediation, payout reconciliation, and supplier payment governance.',
    ownerUserIds: ['user-ops-alex', 'user-approver-dana'],
    policyIds: ['FINANCE-APPROVAL-001', 'FINANCE-APPROVAL-003'],
    defaultExecutionTier: 'HumanApprove',
    evidenceDepth: 'deep',
    allowedActionClasses: ['finance.reconcile', 'finance.notify', 'finance.credit-note'],
    blockedActionClasses: ['finance.pay-large-supplier-without-approval'],
    portFamilies: ['FinanceAccounting', 'PaymentsBilling'],
    workflowHints: ['invoice', 'payout', 'supplier'],
  },
  {
    projectId: 'proj-people-access',
    name: 'People Access',
    summary: 'HRIS onboarding and IAM review work with SoD-aware approval coverage.',
    ownerUserIds: ['user-ops-sam', 'user-admin'],
    policyIds: ['IAM-APPROVAL-002'],
    defaultExecutionTier: 'Assisted',
    evidenceDepth: 'standard',
    allowedActionClasses: ['hris.sync', 'iam.review', 'iam.revoke-excess-access'],
    blockedActionClasses: ['iam.grant-admin-without-approval'],
    portFamilies: ['HrisHcm', 'IamDirectory'],
    workflowHints: ['employee', 'onboarding', 'iam', 'access'],
  },
  {
    projectId: 'proj-revenue-operations',
    name: 'Revenue Operations',
    summary: 'CRM cleanup and revenue data quality automation.',
    ownerUserIds: ['user-ops-alex'],
    policyIds: ['CRM-DATA-QUALITY-001'],
    defaultExecutionTier: 'Auto',
    evidenceDepth: 'standard',
    allowedActionClasses: ['crm.dedupe', 'crm.classify', 'crm.report'],
    blockedActionClasses: ['crm.delete-contact-bulk'],
    portFamilies: ['CrmSales', 'MarketingAutomation'],
    workflowHints: ['crm', 'lead', 'dedup'],
  },
];

export function buildProjectPortfolio(args: {
  workspaceId: string;
  workItems: readonly WorkItemSummary[];
  runs: readonly RunSummary[];
  approvals: readonly ApprovalSummary[];
  evidence: readonly EvidenceEntry[];
}): ProjectSummary[] {
  const explicit = PROJECT_DEFINITIONS.map((definition) =>
    buildProjectSummary(definition, args.workspaceId, args),
  );
  const coveredWorkItemIds = new Set(
    PROJECT_DEFINITIONS.flatMap((definition) =>
      args.workItems
        .filter((item) => item.workspaceId === args.workspaceId && matchesProject(item, definition))
        .map((item) => item.workItemId),
    ),
  );
  const uncategorizedWorkItems = args.workItems.filter(
    (item) => item.workspaceId === args.workspaceId && !coveredWorkItemIds.has(item.workItemId),
  );

  if (uncategorizedWorkItems.length === 0) return explicit;

  return [
    ...explicit,
    buildProjectSummary(
      {
        projectId: 'proj-general-operations',
        name: 'General Operations',
        summary:
          'Workspace-level Project for Work Items not yet scoped to a more specific Project.',
        ownerUserIds: ['user-ops-alex'],
        policyIds: ['WORKSPACE-BASELINE-001'],
        defaultExecutionTier: 'Assisted',
        evidenceDepth: 'standard',
        allowedActionClasses: ['workspace.triage', 'workspace.link-evidence'],
        blockedActionClasses: ['workspace.bypass-policy'],
        portFamilies: [],
        workflowHints: [],
      },
      args.workspaceId,
      { ...args, workItems: uncategorizedWorkItems },
    ),
  ];
}

function buildProjectSummary(
  definition: ProjectDefinition,
  workspaceId: string,
  data: {
    workItems: readonly WorkItemSummary[];
    runs: readonly RunSummary[];
    approvals: readonly ApprovalSummary[];
    evidence: readonly EvidenceEntry[];
  },
): ProjectSummary {
  const workItems = data.workItems.filter(
    (item) => item.workspaceId === workspaceId && matchesProject(item, definition),
  );
  const workItemIds = new Set(workItems.map((item) => item.workItemId));
  const linkedRunIds = new Set(workItems.flatMap((item) => item.links?.runIds ?? []));
  const linkedApprovalIds = new Set(workItems.flatMap((item) => item.links?.approvalIds ?? []));

  const runs = data.runs.filter(
    (run) =>
      run.workspaceId === workspaceId &&
      (linkedRunIds.has(run.runId) || matchesWorkflowHint(run.workflowId, definition)),
  );
  for (const run of runs) linkedRunIds.add(run.runId);

  const approvals = data.approvals.filter(
    (approval) =>
      approval.workspaceId === workspaceId &&
      (linkedApprovalIds.has(approval.approvalId) ||
        linkedRunIds.has(approval.runId) ||
        (approval.workItemId !== undefined && workItemIds.has(approval.workItemId))),
  );
  const evidence = data.evidence.filter(
    (entry) =>
      entry.workspaceId === workspaceId &&
      ((entry.links?.workItemId !== undefined && workItemIds.has(entry.links.workItemId)) ||
        (entry.links?.runId !== undefined && linkedRunIds.has(entry.links.runId))),
  );

  const metrics = {
    workItemCount: workItems.length,
    activeRunCount: runs.filter((run) => ACTIVE_RUN_STATUSES.has(run.status)).length,
    pendingApprovalCount: approvals.filter((approval) => approval.status === 'Pending').length,
    evidenceCount: evidence.length,
    artifactCount: evidence.reduce((sum, entry) => sum + (entry.payloadRefs?.length ?? 0), 0),
    policyViolationCount: evidence.filter((entry) => entry.category === 'PolicyViolation').length,
  };

  return {
    schemaVersion: 1,
    projectId: definition.projectId,
    workspaceId,
    name: definition.name,
    status: metrics.activeRunCount > 0 ? 'Active' : metrics.workItemCount > 0 ? 'Paused' : 'Active',
    governancePosture: governancePosture(metrics),
    governance: {
      ownerUserIds: [...definition.ownerUserIds],
      policyIds: [...definition.policyIds],
      defaultExecutionTier: definition.defaultExecutionTier,
      evidenceDepth: definition.evidenceDepth,
      allowedActionClasses: [...definition.allowedActionClasses],
      blockedActionClasses: [...definition.blockedActionClasses],
    },
    metrics,
    latestActivityAtIso: latestActivity(workItems, runs, approvals, evidence),
    summary: definition.summary,
  };
}

function matchesProject(item: WorkItemSummary, definition: ProjectDefinition): boolean {
  if (definition.portFamilies.length === 0 && definition.workflowHints.length === 0) {
    return true;
  }

  const text = `${item.title} ${item.links?.externalRefs
    ?.map((ref) => `${ref.portFamily} ${ref.sorName} ${ref.externalType}`)
    .join(' ')}`;
  const normalized = text.toLowerCase();
  return (
    definition.portFamilies.some((family) =>
      item.links?.externalRefs?.some((ref) => ref.portFamily === family),
    ) || definition.workflowHints.some((hint) => normalized.includes(hint))
  );
}

function matchesWorkflowHint(workflowId: string, definition: ProjectDefinition): boolean {
  const normalized = workflowId.toLowerCase();
  return definition.workflowHints.some((hint) => normalized.includes(hint));
}

function governancePosture(
  metrics: ProjectSummary['metrics'],
): ProjectSummary['governancePosture'] {
  if (metrics.policyViolationCount > 0) return 'Blocked';
  if (metrics.pendingApprovalCount > 0 || metrics.activeRunCount > 0) return 'Attention';
  return 'Clear';
}

function latestActivity(
  workItems: readonly WorkItemSummary[],
  runs: readonly RunSummary[],
  approvals: readonly ApprovalSummary[],
  evidence: readonly EvidenceEntry[],
): string | undefined {
  const timestamps = [
    ...workItems.map((item) => item.createdAtIso),
    ...runs.flatMap((run) => [run.createdAtIso, run.startedAtIso, run.endedAtIso]),
    ...approvals.flatMap((approval) => [
      approval.requestedAtIso,
      approval.decidedAtIso,
      approval.dueAtIso,
    ]),
    ...evidence.map((entry) => entry.occurredAtIso),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return timestamps.sort((a, b) => b.localeCompare(a))[0];
}
