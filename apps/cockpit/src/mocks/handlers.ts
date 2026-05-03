import { http, HttpResponse } from 'msw';
import type { MeridianDataset } from './fixtures/meridian-seed';
import type {
  ApprovalDecisionRequest,
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  CreateApprovalRequest,
  EscalateHumanTaskRequest,
  CreateCredentialGrantRequest,
  CredentialGrantV1,
  HumanTaskSummary,
  IntentPlanRequest,
  IntentPlanResponse,
  EvidenceEntry,
  ApprovalCoverageRosterSummary,
  CreateApprovalCoverageWindowRequest,
  CreateApprovalDelegationRequest,
  UpsertApprovalSpecialistRoutingRuleRequest,
  RunInterventionRequest,
  UpdateWorkflowRequest,
  UpdateWorkItemCommand,
  WorkflowSummary,
  MachineV1,
  AgentCapability,
  AdapterSummary,
  PolicySummary,
} from '@portarium/cockpit-types';
import { buildMockWorkflows } from './fixtures/workflows';
import { buildMockHumanTasks } from './fixtures/human-tasks';
import { ROBOT_LOCATIONS, GEOFENCES, SPATIAL_ALERTS } from './fixtures/robot-locations';
import { MOCK_USERS, type UserSummary } from './fixtures/users';
import { MOCK_POLICIES, MOCK_SOD_CONSTRAINTS } from './fixtures/policies';
import { MOCK_GATEWAYS } from './fixtures/gateways';
import { DEFAULT_PACK_UI_RUNTIME, DEMO_PACK_UI_RUNTIME } from './fixtures/pack-ui-runtime';
import { buildProjectPortfolio } from './fixtures/projects';
import { resolveStoredDataset } from '@/lib/cockpit-runtime';

// ---------------------------------------------------------------------------
// Mutable dataset reference — replaced at bootstrap via loadActiveDataset()
// ---------------------------------------------------------------------------

let data: MeridianDataset | null = null;

// In-memory mutable state for mutation demo
let approvals: MeridianDataset['APPROVALS'] = [];
let credentialGrants: CredentialGrantV1[] = [];
let approvalCoverageRoster: ApprovalCoverageRosterSummary = emptyApprovalCoverageRoster('ws-demo');
let humanTasks: HumanTaskSummary[] = [];
let evidence: EvidenceEntry[] = [];
let workItems: MeridianDataset['WORK_ITEMS'] = [];
let users: UserSummary[] = [...MOCK_USERS];
let agents: MeridianDataset['AGENTS'] = [];
let machines: MeridianDataset['MACHINES'] = [];
let runs: MeridianDataset['RUNS'] = [];
let missions: MeridianDataset['MISSIONS'] = [];
let globalEstopActive = false;
let workflowOverrides = new Map<string, Partial<WorkflowSummary>>();

export async function loadActiveDataset(): Promise<void> {
  const { DATASETS } = await import('./fixtures/index');
  const stored = resolveStoredDataset(import.meta.env, localStorage);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const entry = (DATASETS.find((d) => d.id === stored) ?? DATASETS[0])!;
  data = await entry.load();
  approvals = [...data.APPROVALS];
  evidence = [...data.EVIDENCE];
  workItems = [...data.WORK_ITEMS];
  credentialGrants = [...data.CREDENTIAL_GRANTS];
  approvalCoverageRoster =
    data.APPROVAL_COVERAGE_ROSTER ??
    emptyApprovalCoverageRoster(data.RUNS[0]?.workspaceId ?? 'ws-demo');
  humanTasks = buildMockHumanTasks(data.RUNS, data.WORK_ITEMS, data.WORKFORCE_MEMBERS);
  agents = [...data.AGENTS];
  machines = [...(data.MACHINES ?? [])];
  runs = [...data.RUNS];
  missions = [...(data.MISSIONS ?? [])];
  workflowOverrides = new Map<string, Partial<WorkflowSummary>>();
}

function emptyApprovalCoverageRoster(workspaceId: string): ApprovalCoverageRosterSummary {
  return {
    schemaVersion: 1,
    workspaceId,
    coverageWindows: [],
    delegations: [],
    specialistRoutingRules: [],
    auditTrail: [],
    routingPreviews: [],
  };
}

function appendCoverageAudit(
  roster: ApprovalCoverageRosterSummary,
  entry: Omit<ApprovalCoverageRosterSummary['auditTrail'][number], 'schemaVersion' | 'workspaceId'>,
): ApprovalCoverageRosterSummary {
  return {
    ...roster,
    auditTrail: [
      {
        schemaVersion: 1,
        workspaceId: roster.workspaceId,
        ...entry,
      },
      ...roster.auditTrail,
    ],
  };
}

function getWorkflows(): WorkflowSummary[] {
  const base = buildMockWorkflows(runs, agents);
  return base.map((workflow) => {
    const override = workflowOverrides.get(workflow.workflowId);
    if (!override) return workflow;
    return {
      ...workflow,
      ...override,
      actions: override.actions ?? workflow.actions,
    };
  });
}

function findWorkflowById(workflowId: string): WorkflowSummary | null {
  return getWorkflows().find((workflow) => workflow.workflowId === workflowId) ?? null;
}

type WorkspaceUserRole = 'admin' | 'operator' | 'approver' | 'auditor';

type WorkspaceUser = Readonly<{
  userId: string;
  workspaceId: string;
  email: string;
  displayName?: string;
  roles: WorkspaceUserRole[];
  active: boolean;
  createdAtIso: string;
}>;

type AdapterRegistration = Readonly<{
  schemaVersion: 1;
  adapterId: string;
  workspaceId: string;
  providerSlug: string;
  portFamily: string;
  enabled: boolean;
  capabilityMatrix: readonly { operation: string; requiresAuth: boolean }[];
  executionPolicy: {
    tenantIsolationMode: 'PerTenantWorker';
    egressAllowlist: readonly string[];
    credentialScope: 'capabilityMatrix';
    sandboxVerified: true;
    sandboxAvailable: boolean;
  };
}>;

type PolicyV1 = Readonly<{
  schemaVersion: 1;
  policyId: string;
  workspaceId: string;
  name: string;
  description?: string;
  active: boolean;
  priority: number;
  version: number;
  createdAtIso: string;
  createdByUserId: string;
  rules?: readonly { ruleId: string; condition: string; effect: 'Allow' | 'Deny' }[];
}>;

const ROLE_TO_API: Readonly<Record<UserSummary['role'], WorkspaceUserRole>> = {
  Admin: 'admin',
  Operator: 'operator',
  Approver: 'approver',
  Auditor: 'auditor',
};

const ROLE_FROM_API: Readonly<Record<WorkspaceUserRole, UserSummary['role']>> = {
  admin: 'Admin',
  operator: 'Operator',
  approver: 'Approver',
  auditor: 'Auditor',
};

function toWorkspaceUser(user: UserSummary, workspaceId: string): WorkspaceUser {
  return {
    userId: user.userId,
    workspaceId,
    email: user.email,
    displayName: user.name,
    roles: [ROLE_TO_API[user.role] ?? 'auditor'],
    active: user.status === 'active',
    createdAtIso: user.lastActiveIso,
  };
}

function toAdapterRegistration(adapter: AdapterSummary, workspaceId: string): AdapterRegistration {
  return {
    schemaVersion: 1,
    adapterId: adapter.adapterId,
    workspaceId,
    providerSlug: adapter.name,
    portFamily: adapter.sorFamily,
    enabled: adapter.status !== 'unhealthy',
    capabilityMatrix: [{ operation: 'record:read', requiresAuth: true }],
    executionPolicy: {
      tenantIsolationMode: 'PerTenantWorker',
      egressAllowlist: ['https://mock.portarium.local'],
      credentialScope: 'capabilityMatrix',
      sandboxVerified: true,
      sandboxAvailable: true,
    },
  };
}

function toPolicyV1(policy: PolicySummary, workspaceId: string, index: number): PolicyV1 {
  return {
    schemaVersion: 1,
    policyId: policy.policyId,
    workspaceId,
    name: policy.name,
    description: policy.description,
    active: policy.status !== 'Archived',
    priority: index + 1,
    version: 1,
    createdAtIso: '2026-02-20T00:00:00Z',
    createdByUserId: 'user-admin',
    rules: [
      {
        ruleId: `${policy.policyId}-rule-1`,
        condition: policy.ruleText || 'true',
        effect: policy.status === 'Draft' ? 'Allow' : 'Deny',
      },
    ],
  };
}

export const handlers = [
  // Workspace list
  http.get('/v1/workspaces', () => {
    const workspaceId = runs[0]?.workspaceId ?? data?.RUNS[0]?.workspaceId ?? 'ws-demo';
    return HttpResponse.json({ items: [{ workspaceId, name: workspaceId }] });
  }),

  // Work Items
  http.get('/v1/workspaces/:wsId/work-items', () =>
    HttpResponse.json({ items: workItems.length > 0 ? workItems : (data?.WORK_ITEMS ?? []) }),
  ),
  http.get('/v1/workspaces/:wsId/projects', ({ params }) => {
    const workspaceId = String(params['wsId'] ?? runs[0]?.workspaceId ?? 'ws-demo');
    return HttpResponse.json({
      items: buildProjectPortfolio({
        workspaceId,
        workItems: workItems.length > 0 ? workItems : (data?.WORK_ITEMS ?? []),
        runs,
        approvals,
        evidence,
      }),
    });
  }),
  http.get('/v1/workspaces/:wsId/work-items/:wiId', ({ params }) => {
    const list = workItems.length > 0 ? workItems : (data?.WORK_ITEMS ?? []);
    const item = list.find((w) => w.workItemId === params['wiId']);
    if (!item) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(item);
  }),
  http.patch('/v1/workspaces/:wsId/work-items/:wiId', async ({ request, params }) => {
    const body = (await request.json()) as UpdateWorkItemCommand;
    const wiId = String(params['wiId'] ?? '');
    workItems = workItems.map((w) => (w.workItemId === wiId ? { ...w, ...body } : w));
    const updated = workItems.find((w) => w.workItemId === wiId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Runs
  http.get('/v1/workspaces/:wsId/runs', ({ request }) => {
    const url = new URL(request.url);
    let filtered = [...runs];

    // Field filters
    const status = url.searchParams.get('status');
    if (status) filtered = filtered.filter((r) => r.status === status);
    const tier = url.searchParams.get('tier');
    if (tier) filtered = filtered.filter((r) => r.executionTier === tier);
    const workflowId = url.searchParams.get('workflowId');
    if (workflowId) filtered = filtered.filter((r) => r.workflowId === workflowId);

    // Search
    const q = url.searchParams.get('q');
    if (q) {
      const term = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.runId.toLowerCase().includes(term) ||
          r.workflowId.toLowerCase().includes(term) ||
          r.correlationId.toLowerCase().includes(term),
      );
    }

    // Sort
    const sortRaw = url.searchParams.get('sort');
    if (sortRaw) {
      const [field, dir] = sortRaw.split(':');
      const direction = dir === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const va = String((a as unknown as Record<string, unknown>)[field!] ?? '');
        const vb = String((b as unknown as Record<string, unknown>)[field!] ?? '');
        return va.localeCompare(vb) * direction;
      });
    }

    // Cursor pagination
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      const idx = filtered.findIndex((r) => r.runId === cursor);
      filtered = idx >= 0 ? filtered.slice(idx + 1) : filtered;
    }

    const limit = Number(url.searchParams.get('limit')) || 50;
    const hasMore = filtered.length > limit;
    const items = filtered.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.runId : undefined;

    return HttpResponse.json({ items, ...(nextCursor ? { nextCursor } : {}) });
  }),
  http.get('/v1/workspaces/:wsId/runs/:runId', ({ params }) => {
    const run = runs.find((r) => r.runId === params['runId']);
    if (!run) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(run);
  }),
  http.post('/v1/workspaces/:wsId/runs', async ({ request, params }) => {
    const body = (await request.json()) as {
      workflowId: string;
      parameters?: Record<string, unknown>;
    };
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const newRun = {
      schemaVersion: 1,
      runId: `run-${Date.now()}`,
      workspaceId: wsId,
      workflowId: body.workflowId,
      correlationId: `corr-${Date.now()}`,
      executionTier: 'Auto' as const,
      initiatedByUserId: 'user-001',
      status: 'Running' as const,
      createdAtIso: new Date().toISOString(),
      startedAtIso: new Date().toISOString(),
    };
    runs = [newRun, ...runs];
    const operatorIntent =
      typeof body.parameters?.['operatorIntent'] === 'string'
        ? body.parameters['operatorIntent'].trim()
        : '';
    if (operatorIntent) {
      const previousHash = evidence[evidence.length - 1]?.hashSha256;
      const evidenceId = `ev-launch-${Date.now()}`;
      evidence = [
        ...evidence,
        {
          schemaVersion: 1,
          evidenceId,
          workspaceId: wsId,
          occurredAtIso: new Date().toISOString(),
          category: 'Plan',
          summary: `intent: ${operatorIntent}`,
          actor: { kind: 'User', userId: 'user-001' },
          links: { runId: newRun.runId },
          ...(previousHash ? { previousHash } : {}),
          hashSha256: `mock-${evidenceId}`,
        },
      ];
    }
    return HttpResponse.json(newRun, { status: 201 });
  }),
  http.post('/v1/workspaces/:wsId/runs/:runId/cancel', ({ params }) => {
    const runId = String(params['runId'] ?? '');
    runs = runs.map((r) =>
      r.runId === runId
        ? { ...r, status: 'Cancelled' as const, endedAtIso: new Date().toISOString() }
        : r,
    );
    const updated = runs.find((r) => r.runId === runId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),
  http.post('/v1/workspaces/:wsId/runs/:runId/interventions', async ({ request, params }) => {
    const body = (await request.json()) as RunInterventionRequest;
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const runId = String(params['runId'] ?? '');
    const nowIso = new Date().toISOString();
    const nextStatus =
      body.interventionType === 'pause' ||
      body.interventionType === 'freeze' ||
      body.interventionType === 'request-evidence' ||
      body.interventionType === 'request-more-evidence' ||
      body.interventionType === 'sandbox' ||
      body.interventionType === 'emergency-disable'
        ? ('Paused' as const)
        : body.interventionType === 'resume'
          ? ('Running' as const)
          : undefined;
    const nextControlState =
      body.interventionType === 'freeze' || body.interventionType === 'emergency-disable'
        ? ('frozen' as const)
        : body.interventionType === 'request-evidence' ||
            body.interventionType === 'request-more-evidence' ||
            body.interventionType === 'escalate'
          ? ('blocked' as const)
          : body.interventionType === 'sandbox'
            ? ('degraded' as const)
            : body.interventionType === 'handoff' || body.interventionType === 'reroute'
              ? ('operator-owned' as const)
              : body.interventionType === 'resume'
                ? undefined
                : undefined;

    runs = runs.map((r) => {
      if (r.runId !== runId) return r;
      const updatedRun = {
        ...r,
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextStatus === 'Running' ? { endedAtIso: undefined } : {}),
        ...(nextControlState ? { controlState: nextControlState } : {}),
        ...(body.target ? { operatorOwnerId: body.target } : {}),
      };
      if (!nextControlState) delete updatedRun.controlState;
      if (!body.target) delete updatedRun.operatorOwnerId;
      return updatedRun;
    });
    const updated = runs.find((r) => r.runId === runId);
    if (!updated) return HttpResponse.json(null, { status: 404 });

    const previousHash = evidence[evidence.length - 1]?.hashSha256;
    const evidenceId = `ev-intervention-${Date.now()}`;
    evidence = [
      ...evidence,
      {
        schemaVersion: 1,
        evidenceId,
        workspaceId: wsId,
        occurredAtIso: nowIso,
        category: body.interventionType === 'annotate' ? 'System' : 'Action',
        summary: `${body.interventionType}: ${body.rationale}${
          body.authoritySource ? ` (${body.authoritySource})` : ''
        }`,
        actor: { kind: 'User', userId: 'user-001' },
        links: { runId },
        ...(previousHash ? { previousHash } : {}),
        hashSha256: `mock-${evidenceId}`,
      },
    ];

    return HttpResponse.json(updated);
  }),

  // Workflows
  http.get('/v1/workspaces/:wsId/workflows', () => HttpResponse.json({ items: getWorkflows() })),
  http.get('/v1/workspaces/:wsId/workflows/:workflowId', ({ params }) => {
    const workflow = findWorkflowById(String(params['workflowId'] ?? ''));
    if (!workflow) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(workflow);
  }),
  http.patch('/v1/workspaces/:wsId/workflows/:workflowId', async ({ request, params }) => {
    const workflowId = String(params['workflowId'] ?? '');
    const existing = findWorkflowById(workflowId);
    if (!existing) return HttpResponse.json(null, { status: 404 });

    const body = (await request.json()) as UpdateWorkflowRequest;
    const nextVersion = existing.version + 1;
    const merged: WorkflowSummary = {
      ...existing,
      ...body,
      actions: body.actions ?? existing.actions,
      version: nextVersion,
    };
    workflowOverrides.set(workflowId, {
      ...workflowOverrides.get(workflowId),
      ...body,
      actions: merged.actions,
      version: nextVersion,
    });

    return HttpResponse.json(merged);
  }),

  // Intent planning
  http.post('/v1/workspaces/:wsId/intents:plan', async ({ request, params }) => {
    const body = (await request.json()) as IntentPlanRequest;
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const normalizedGoal = body.triggerText.replace(/\s+/g, ' ').trim();
    const proposalId = `proposal-${Date.now()}`;
    const effectId = `effect-${proposalId}`;
    const result: IntentPlanResponse = {
      intent: {
        schemaVersion: 1,
        intentId: `intent-${Date.now()}`,
        workspaceId: wsId,
        createdAtIso: new Date().toISOString(),
        createdByUserId: 'user-001',
        source: body.source ?? 'Human',
        prompt: body.triggerText,
        normalizedGoal,
        constraints: body.constraints ?? [],
      },
      plan: {
        schemaVersion: 1,
        planId: `plan-${proposalId}`,
        workspaceId: wsId,
        createdAtIso: new Date().toISOString(),
        createdByUserId: 'user-001',
        plannedEffects: [
          {
            effectId,
            operation: 'Create',
            target: {
              sorName: 'Portarium',
              portFamily: 'ProjectsWorkMgmt',
              externalId: proposalId,
              externalType: 'BeadProposal',
              displayLabel: normalizedGoal,
            },
            summary: normalizedGoal,
          },
        ],
      },
      proposals: [
        {
          schemaVersion: 1,
          proposalId,
          title: normalizedGoal,
          body: `Implement this operator intent: ${normalizedGoal}.`,
          executionTier: 'HumanApprove',
          specRef:
            'docs/internal/engineering-layer/build-plan.md#phase-7--intent-trigger-full-loop',
          dependsOnProposalIds: [],
          plannedEffectIds: [effectId],
        },
      ],
      artifact: {
        schemaVersion: 1,
        artifactId: `plan-artifact-${proposalId}`,
        title: `Plan: ${normalizedGoal}`,
        markdown: `# Plan: "${normalizedGoal}"\n\nDecomposed into 1 bead proposal by BeadPlanner.\n\n## Beads\n\n1. ${normalizedGoal} [HumanApprove]\n\n## Confirmation\n\nHuman approval is required before any worktree is created.`,
      },
    };
    return HttpResponse.json(result);
  }),

  // Approvals
  http.get('/v1/workspaces/:wsId/approvals', () => HttpResponse.json({ items: approvals })),
  http.post('/v1/workspaces/:wsId/approvals', async ({ request, params }) => {
    const body = (await request.json()) as CreateApprovalRequest;
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const nowIso = new Date().toISOString();
    const approval = {
      schemaVersion: 1,
      approvalId: `apr-${Date.now()}`,
      workspaceId: wsId,
      runId: body.runId,
      planId: body.planId,
      ...(body.workItemId ? { workItemId: body.workItemId } : {}),
      prompt: body.prompt,
      requestedAtIso: nowIso,
      requestedByUserId: data?.WORKFORCE_MEMBERS[0]?.linkedUserId ?? 'user-system',
      ...(body.assigneeUserId ? { assigneeUserId: body.assigneeUserId } : {}),
      ...(body.dueAtIso ? { dueAtIso: body.dueAtIso } : {}),
      status: 'Pending' as const,
    };
    approvals = [approval, ...approvals];
    return HttpResponse.json(approval, { status: 201 });
  }),
  http.get('/v1/workspaces/:wsId/approvals/:id', ({ params }) => {
    const approval = approvals.find((a) => a.approvalId === params['id']);
    if (!approval) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(approval);
  }),
  http.post('/v1/workspaces/:wsId/approvals/:id/decide', async ({ request, params }) => {
    const body = (await request.json()) as ApprovalDecisionRequest;
    approvals = approvals.map((a) =>
      a.approvalId === params['id']
        ? {
            ...a,
            status: body.decision,
            decidedAtIso: new Date().toISOString(),
            decidedByUserId:
              approvals.find((a) => a.approvalId === params['id'])?.assigneeUserId ??
              data?.WORKFORCE_MEMBERS[0]?.linkedUserId ??
              'user-system',
            rationale: body.rationale,
          }
        : a,
    );
    const updated = approvals.find((a) => a.approvalId === params['id']);
    return HttpResponse.json(updated);
  }),

  // Event streams
  http.get('/v1/workspaces/:wsId/events:stream', () => {
    return new HttpResponse(
      [
        'event: com.portarium.approval.ApprovalRequested',
        'data: {"approvalId":"apr-3001","runId":"run-2001"}',
        '',
        '',
      ].join('\n'),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  }),
  http.get('/v1/workspaces/:wsId/beads/:beadId/thread', ({ params }) => {
    const beadId = String(params['beadId'] ?? 'bead-demo');
    return HttpResponse.json({
      items: [
        {
          id: `${beadId}:tool-call`,
          toolName: 'apply patch',
          args: { beadId },
          status: 'awaiting_approval',
          policyTier: 'HumanApprove',
          blastRadius: 'medium',
          approvalId: 'apr-3001',
          policyRuleId: 'COMMUNICATION-APPROVAL-001',
          rationale: 'Cockpit mock bead thread snapshot',
          occurredAtIso: '2026-02-20T14:30:00Z',
        },
      ],
    });
  }),
  http.get('/v1/workspaces/:wsId/beads/:beadId/events', ({ params }) => {
    const beadId = String(params['beadId'] ?? 'bead-demo');
    return new HttpResponse(
      [
        'id: 1',
        'event: com.portarium.agent.ToolCallProposed',
        `data: {"id":"${beadId}:tool-call","toolName":"apply patch","args":{"beadId":"${beadId}"},"status":"awaiting_approval","policyTier":"HumanApprove","blastRadius":"medium","approvalId":"apr-3001","occurredAtIso":"2026-02-20T14:30:00Z"}`,
        '',
        '',
      ].join('\n'),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  }),

  // Bead diff
  http.get('/v1/workspaces/:wsId/beads/:beadId/diff', ({ params }) => {
    const beadId = String(params['beadId'] ?? 'bead-demo');
    return HttpResponse.json([
      {
        hunkId: `${beadId}:proposal`,
        filePath: `issues/${beadId}/proposal.md`,
        changeType: 'modified',
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 3,
        lines: [
          { op: 'context', oldLineNumber: 1, newLineNumber: 1, content: `# ${beadId}` },
          { op: 'remove', oldLineNumber: 2, content: 'Status: ready' },
          { op: 'add', newLineNumber: 2, content: 'Status: awaiting approval' },
          { op: 'add', newLineNumber: 3, content: 'Review surface: Cockpit diff approval' },
        ],
      },
      {
        hunkId: `${beadId}:policy`,
        filePath: `policies/${beadId}.json`,
        changeType: 'added',
        oldStart: 0,
        oldCount: 0,
        newStart: 1,
        newCount: 3,
        lines: [
          { op: 'add', newLineNumber: 1, content: '{' },
          { op: 'add', newLineNumber: 2, content: '  "requiresApproval": true' },
          { op: 'add', newLineNumber: 3, content: '}' },
        ],
      },
    ]);
  }),

  // Plans
  http.get('/v1/workspaces/:wsId/plans/:planId', ({ params }) => {
    const plan = data?.PLANS?.find((p) => p.planId === params['planId']);
    if (!plan) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(plan);
  }),

  // Evidence
  http.get('/v1/workspaces/:wsId/evidence', () => HttpResponse.json({ items: evidence })),

  // Workforce
  http.get('/v1/workspaces/:wsId/workforce', () =>
    HttpResponse.json({ items: data?.WORKFORCE_MEMBERS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/workforce/queues', () =>
    HttpResponse.json({ items: data?.WORKFORCE_QUEUES ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/workforce/approval-coverage', ({ params }) => {
    const wsId = String(params['wsId'] ?? approvalCoverageRoster.workspaceId);
    if (approvalCoverageRoster.workspaceId !== wsId) {
      approvalCoverageRoster = emptyApprovalCoverageRoster(wsId);
    }
    return HttpResponse.json(approvalCoverageRoster);
  }),
  http.post(
    '/v1/workspaces/:wsId/workforce/approval-coverage/windows',
    async ({ request, params }) => {
      const wsId = String(params['wsId'] ?? approvalCoverageRoster.workspaceId);
      const body = (await request.json()) as CreateApprovalCoverageWindowRequest;
      const nowIso = new Date().toISOString();
      const id = `cov-${Date.now()}`;
      const nextRoster =
        approvalCoverageRoster.workspaceId === wsId
          ? approvalCoverageRoster
          : emptyApprovalCoverageRoster(wsId);

      approvalCoverageRoster = appendCoverageAudit(
        {
          ...nextRoster,
          coverageWindows: [
            {
              schemaVersion: 1,
              coverageWindowId: id,
              workspaceId: wsId,
              name: body.name,
              approvalClass: body.approvalClass,
              startsAtIso: body.startsAtIso,
              endsAtIso: body.endsAtIso,
              timezone: body.timezone,
              queueId: body.queueId,
              primaryMemberIds: body.primaryMemberIds,
              ...(body.fallbackQueueId ? { fallbackQueueId: body.fallbackQueueId } : {}),
              state: 'active',
              updatedByUserId: 'user-ops-alex',
              updatedAtIso: nowIso,
            },
            ...nextRoster.coverageWindows,
          ],
          routingPreviews: [
            {
              schemaVersion: 1,
              approvalId: `preview-${id}`,
              approvalClass: body.approvalClass,
              state: 'assigned',
              primaryTargetLabel: body.primaryMemberIds[0] ?? body.queueId,
              fallbackTargetLabel: body.fallbackQueueId,
              explanation: `New coverage window '${body.name}' would route matching approvals to the selected primary roster.`,
              authoritySource: 'workspace-rbac',
              auditEvidenceId: `evd-${id}`,
            },
            ...nextRoster.routingPreviews,
          ],
        },
        {
          auditId: `aud-${id}`,
          changedAtIso: nowIso,
          changedByUserId: 'user-ops-alex',
          governanceFunction: 'operator',
          authoritySource: 'workspace-rbac',
          action: 'coverage-window-created',
          targetType: 'coverage-window',
          targetId: id,
          summary: `Created coverage window '${body.name}': ${body.rationale}`,
          evidenceId: `evd-${id}`,
        },
      );

      return HttpResponse.json(approvalCoverageRoster, { status: 201 });
    },
  ),
  http.post(
    '/v1/workspaces/:wsId/workforce/approval-coverage/delegations',
    async ({ request, params }) => {
      const wsId = String(params['wsId'] ?? approvalCoverageRoster.workspaceId);
      const body = (await request.json()) as CreateApprovalDelegationRequest;
      const nowIso = new Date().toISOString();
      const id = `del-${Date.now()}`;
      const nextRoster =
        approvalCoverageRoster.workspaceId === wsId
          ? approvalCoverageRoster
          : emptyApprovalCoverageRoster(wsId);

      approvalCoverageRoster = appendCoverageAudit(
        {
          ...nextRoster,
          delegations: [
            {
              schemaVersion: 1,
              delegationId: id,
              workspaceId: wsId,
              delegatorUserId: body.delegatorUserId,
              delegateUserId: body.delegateUserId,
              approvalClass: body.approvalClass,
              startsAtIso: body.startsAtIso,
              expiresAtIso: body.expiresAtIso,
              reason: body.reason,
              active: true,
              updatedByUserId: 'user-ops-alex',
              updatedAtIso: nowIso,
            },
            ...nextRoster.delegations,
          ],
          routingPreviews: [
            {
              schemaVersion: 1,
              approvalId: `preview-${id}`,
              approvalClass: body.approvalClass,
              state: 'delegated',
              primaryTargetLabel: body.delegateUserId,
              explanation: `Matching approvals can be decided by delegate ${body.delegateUserId} until ${body.expiresAtIso}.`,
              authoritySource: 'queue-delegation',
              auditEvidenceId: `evd-${id}`,
            },
            ...nextRoster.routingPreviews,
          ],
        },
        {
          auditId: `aud-${id}`,
          changedAtIso: nowIso,
          changedByUserId: 'user-ops-alex',
          governanceFunction: 'operator',
          authoritySource: 'queue-delegation',
          action: 'delegate-created',
          targetType: 'delegation',
          targetId: id,
          summary: `Delegated ${body.approvalClass} from ${body.delegatorUserId} to ${body.delegateUserId}: ${body.reason}`,
          evidenceId: `evd-${id}`,
        },
      );

      return HttpResponse.json(approvalCoverageRoster, { status: 201 });
    },
  ),
  http.post(
    '/v1/workspaces/:wsId/workforce/approval-coverage/specialist-routes',
    async ({ request, params }) => {
      const wsId = String(params['wsId'] ?? approvalCoverageRoster.workspaceId);
      const body = (await request.json()) as UpsertApprovalSpecialistRoutingRuleRequest;
      const nowIso = new Date().toISOString();
      const id = `route-${Date.now()}`;
      const nextRoster =
        approvalCoverageRoster.workspaceId === wsId
          ? approvalCoverageRoster
          : emptyApprovalCoverageRoster(wsId);

      approvalCoverageRoster = appendCoverageAudit(
        {
          ...nextRoster,
          specialistRoutingRules: [
            {
              schemaVersion: 1,
              routingRuleId: id,
              workspaceId: wsId,
              approvalClass: body.approvalClass,
              matchLabel: body.matchLabel,
              queueId: body.queueId,
              specialistMemberIds: body.specialistMemberIds,
              fallbackQueueId: body.fallbackQueueId,
              priority: body.priority ?? 10,
              active: body.active ?? true,
              updatedByUserId: 'user-ops-alex',
              updatedAtIso: nowIso,
            },
            ...nextRoster.specialistRoutingRules,
          ],
          routingPreviews: [
            {
              schemaVersion: 1,
              approvalId: `preview-${id}`,
              approvalClass: body.approvalClass,
              state: 'assigned',
              primaryTargetLabel: body.specialistMemberIds[0] ?? body.queueId,
              fallbackTargetLabel: body.fallbackQueueId,
              explanation: `Specialist route '${body.matchLabel}' would send matching approvals to the configured specialist roster.`,
              authoritySource: 'queue-delegation',
              auditEvidenceId: `evd-${id}`,
            },
            ...nextRoster.routingPreviews,
          ],
        },
        {
          auditId: `aud-${id}`,
          changedAtIso: nowIso,
          changedByUserId: 'user-ops-alex',
          governanceFunction: 'operator',
          authoritySource: 'queue-delegation',
          action: 'specialist-route-updated',
          targetType: 'specialist-routing-rule',
          targetId: id,
          summary: `Updated specialist route '${body.matchLabel}': ${body.rationale}`,
          evidenceId: `evd-${id}`,
        },
      );

      return HttpResponse.json(approvalCoverageRoster, { status: 201 });
    },
  ),

  // Agents
  http.get('/v1/workspaces/:wsId/agents', () => HttpResponse.json({ items: agents })),
  http.get('/v1/workspaces/:wsId/agents/:agentId', ({ params }) => {
    const agentId = String(params['agentId'] ?? '');
    const agent = agents.find((a) => a.agentId === agentId);
    if (!agent) return HttpResponse.json({ title: 'Not Found' }, { status: 404 });
    return HttpResponse.json(agent);
  }),
  http.post('/v1/workspaces/:wsId/agents', async ({ request, params }) => {
    const body = (await request.json()) as {
      name: string;
      endpoint: string;
      modelId?: string;
      allowedCapabilities?: string[];
      machineId?: string;
      policyTier?: string;
    };
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const newAgent = {
      schemaVersion: 1 as const,
      agentId: `agent-${Date.now()}`,
      workspaceId: wsId,
      name: body.name,
      endpoint: body.endpoint,
      modelId: body.modelId,
      allowedCapabilities: (body.allowedCapabilities ?? []) as AgentCapability[],
      usedByWorkflowIds: [],
      machineId: body.machineId,
      policyTier: body.policyTier as
        | 'Auto'
        | 'Assisted'
        | 'HumanApprove'
        | 'ManualOnly'
        | undefined,
    };
    agents = [newAgent, ...agents];
    return HttpResponse.json(newAgent, { status: 201 });
  }),

  // Machines
  http.get('/v1/workspaces/:wsId/machines', () => HttpResponse.json({ items: machines })),
  http.get('/v1/workspaces/:wsId/machines/:machineId', ({ params }) => {
    const machineId = String(params['machineId'] ?? '');
    const machine = machines.find((m) => m.machineId === machineId);
    if (!machine) return HttpResponse.json({ title: 'Not Found' }, { status: 404 });
    return HttpResponse.json(machine);
  }),
  http.post('/v1/workspaces/:wsId/machines', async ({ request, params }) => {
    const body = (await request.json()) as {
      hostname: string;
      osImage?: string;
      allowedCapabilities?: AgentCapability[];
    };
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const newMachine: MachineV1 = {
      schemaVersion: 1,
      machineId: `machine-${Date.now()}`,
      workspaceId: wsId,
      hostname: body.hostname,
      osImage: body.osImage,
      registeredAtIso: new Date().toISOString(),
      status: 'Online',
      activeRunCount: 0,
      allowedCapabilities: body.allowedCapabilities ?? [],
    };
    machines = [newMachine, ...machines];
    return HttpResponse.json(newMachine, { status: 201 });
  }),

  // Adapters
  http.get('/v1/workspaces/:wsId/adapter-registrations', ({ params }) =>
    HttpResponse.json({
      items: (data?.ADAPTERS ?? []).map((adapter) =>
        toAdapterRegistration(adapter, String(params['wsId'] ?? 'ws-demo')),
      ),
    }),
  ),

  // Credential grants
  http.get('/v1/workspaces/:wsId/credential-grants', () =>
    HttpResponse.json({ items: credentialGrants }),
  ),
  http.post('/v1/workspaces/:wsId/credential-grants', async ({ request, params }) => {
    const body = (await request.json()) as CreateCredentialGrantRequest;
    const wsId = String(params['wsId'] ?? data?.RUNS[0]?.workspaceId ?? 'ws-demo');
    const nowIso = new Date().toISOString();
    const created: CredentialGrantV1 = {
      schemaVersion: 1,
      credentialGrantId: `cg-auto-${Date.now()}`,
      workspaceId: wsId,
      adapterId: body.adapterId,
      credentialsRef: body.credentialsRef,
      scope: body.scope,
      issuedAtIso: nowIso,
      ...(body.expiresAtIso ? { expiresAtIso: body.expiresAtIso } : {}),
    };
    credentialGrants = [created, ...credentialGrants];
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post('/v1/workspaces/:wsId/credential-grants/:credentialGrantId/revoke', ({ params }) => {
    const credentialGrantId = String(params['credentialGrantId'] ?? '');
    const target = credentialGrants.find((grant) => grant.credentialGrantId === credentialGrantId);
    if (!target) return HttpResponse.json(null, { status: 404 });

    const revoked: CredentialGrantV1 = {
      ...target,
      revokedAtIso: new Date().toISOString(),
    };
    credentialGrants = credentialGrants.map((grant) =>
      grant.credentialGrantId === credentialGrantId ? revoked : grant,
    );
    return HttpResponse.json(revoked);
  }),

  // Human Tasks
  http.get('/v1/workspaces/:wsId/human-tasks', () => HttpResponse.json({ items: humanTasks })),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/assign', async ({ request, params }) => {
    const body = (await request.json()) as AssignHumanTaskRequest;
    const taskId = String(params['taskId'] ?? '');
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId
        ? { ...t, assigneeId: body.workforceMemberId, status: 'assigned' as const }
        : t,
    );
    const updated = humanTasks.find((t) => t.humanTaskId === taskId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/complete', async ({ params }) => {
    const taskId = String(params['taskId'] ?? '');
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId
        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
        : t,
    );
    const updated = humanTasks.find((t) => t.humanTaskId === taskId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/escalate', async ({ params }) => {
    const taskId = String(params['taskId'] ?? '');
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId ? { ...t, status: 'escalated' as const } : t,
    );
    const updated = humanTasks.find((t) => t.humanTaskId === taskId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Observability
  http.get('/v1/workspaces/:wsId/observability', () =>
    HttpResponse.json(data?.OBSERVABILITY_DATA ?? {}),
  ),

  // Pack UI runtime
  http.get('/v1/workspaces/:wsId/pack-ui-runtime', ({ params }) => {
    const wsId = String(params['wsId'] ?? 'ws-demo');
    if (wsId === 'ws-meridian') return HttpResponse.json(DEMO_PACK_UI_RUNTIME);
    return HttpResponse.json(DEFAULT_PACK_UI_RUNTIME);
  }),

  // Robotics — Robot Locations (map)
  http.get('/v1/workspaces/:wsId/robotics/robot-locations', () =>
    HttpResponse.json({ items: ROBOT_LOCATIONS, geofences: GEOFENCES, alerts: SPATIAL_ALERTS }),
  ),

  // Robotics — Robots
  http.get('/v1/workspaces/:wsId/robotics/robots', () =>
    HttpResponse.json({ items: data?.ROBOTS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/robots/:robotId', ({ params }) => {
    const robot = data?.ROBOTS.find((r) => r.robotId === params['robotId']);
    if (!robot) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(robot);
  }),

  // Robotics — Missions
  http.get('/v1/workspaces/:wsId/robotics/missions', () => HttpResponse.json({ items: missions })),
  http.get('/v1/workspaces/:wsId/robotics/missions/:missionId', ({ params }) => {
    const mission = missions.find((m) => m.missionId === params['missionId']);
    if (!mission) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(mission);
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/cancel', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Cancelled' as const } : m,
    );
    const updated = missions.find((m) => m.missionId === params['missionId']);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/preempt', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Cancelled' as const } : m,
    );
    const updated = missions.find((m) => m.missionId === params['missionId']);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/retry', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Pending' as const } : m,
    );
    const updated = missions.find((m) => m.missionId === params['missionId']);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // Robotics — Safety
  http.get('/v1/workspaces/:wsId/robotics/safety/constraints', () =>
    HttpResponse.json({ items: data?.SAFETY_CONSTRAINTS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/safety/thresholds', () =>
    HttpResponse.json({ items: data?.APPROVAL_THRESHOLDS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/safety/estop-log', () =>
    HttpResponse.json({ items: data?.ESTOP_AUDIT_LOG ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/safety/estop', () =>
    HttpResponse.json({ active: globalEstopActive }),
  ),
  http.post('/v1/workspaces/:wsId/robotics/safety/estop', () => {
    globalEstopActive = true;
    return HttpResponse.json({ status: 'activated', active: true });
  }),
  http.delete('/v1/workspaces/:wsId/robotics/safety/estop', () => {
    globalEstopActive = false;
    return HttpResponse.json({ status: 'cleared', active: false });
  }),

  // Users
  http.get('/v1/workspaces/:wsId/users', ({ params }) =>
    HttpResponse.json({
      items: users.map((user) => toWorkspaceUser(user, String(params['wsId'] ?? 'ws-demo'))),
    }),
  ),
  http.post('/v1/workspaces/:wsId/users', async ({ request, params }) => {
    const body = (await request.json()) as { email: string; roles?: WorkspaceUserRole[] };
    const wsId = String(params['wsId'] ?? 'ws-demo');
    const role = body.roles?.[0] ?? 'auditor';
    const newUser: UserSummary = {
      userId: `user-${Date.now()}`,
      name: body.email.split('@')[0] ?? 'New User',
      email: body.email,
      role: ROLE_FROM_API[role] ?? 'Auditor',
      status: 'active',
      lastActiveIso: new Date().toISOString(),
    };
    users = [newUser, ...users];
    return HttpResponse.json(toWorkspaceUser(newUser, wsId), { status: 201 });
  }),
  http.patch('/v1/workspaces/:wsId/users/:userId', async ({ request, params }) => {
    const body = (await request.json()) as { roles?: WorkspaceUserRole[]; active?: boolean };
    const userId = String(params['userId'] ?? '');
    users = users.map((u) =>
      u.userId === userId
        ? {
            ...u,
            ...(body.roles?.[0] ? { role: ROLE_FROM_API[body.roles[0]] ?? u.role } : {}),
            ...(body.active !== undefined ? { status: body.active ? 'active' : 'suspended' } : {}),
          }
        : u,
    );
    const updated = users.find((u) => u.userId === userId);
    if (!updated) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(toWorkspaceUser(updated, String(params['wsId'] ?? 'ws-demo')));
  }),

  // Policies
  http.get('/v1/workspaces/:wsId/policies', ({ params }) =>
    HttpResponse.json({
      items: MOCK_POLICIES.map((policy, index) =>
        toPolicyV1(policy, String(params['wsId'] ?? 'ws-demo'), index),
      ),
    }),
  ),
  http.get('/v1/workspaces/:wsId/policies/:policyId', ({ params }) => {
    const index = MOCK_POLICIES.findIndex((p) => p.policyId === params['policyId']);
    const policy = index >= 0 ? MOCK_POLICIES[index] : undefined;
    if (!policy) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(toPolicyV1(policy, String(params['wsId'] ?? 'ws-demo'), index));
  }),

  // SoD Constraints
  http.get('/v1/workspaces/:wsId/sod-constraints', () =>
    HttpResponse.json({ items: MOCK_SOD_CONSTRAINTS }),
  ),

  // Robotics — Gateways
  http.get('/v1/workspaces/:wsId/robotics/gateways', () =>
    HttpResponse.json({ items: MOCK_GATEWAYS }),
  ),

  // Retrieval & Graph
  http.post('/v1/workspaces/:wsId/retrieval/search', async ({ request }) => {
    const body = (await request.json()) as { strategy?: string };
    const { RETRIEVAL_SEARCH_RESULT, GRAPH_TRAVERSAL_RESULT } = await import('./fixtures/demo');
    if (body.strategy === 'graph') {
      return HttpResponse.json({
        strategy: 'graph',
        hits: [],
        graph: GRAPH_TRAVERSAL_RESULT,
      });
    }
    if (body.strategy === 'hybrid') {
      return HttpResponse.json({
        strategy: 'hybrid',
        hits: RETRIEVAL_SEARCH_RESULT.hits,
        graph: GRAPH_TRAVERSAL_RESULT,
      });
    }
    return HttpResponse.json(RETRIEVAL_SEARCH_RESULT);
  }),
  http.post('/v1/workspaces/:wsId/graph/query', async () => {
    const { GRAPH_TRAVERSAL_RESULT } = await import('./fixtures/demo');
    return HttpResponse.json(GRAPH_TRAVERSAL_RESULT);
  }),
  http.get('/v1/workspaces/:wsId/derived-artifacts', async () => {
    const { DERIVED_ARTIFACTS } = await import('./fixtures/demo');
    return HttpResponse.json(DERIVED_ARTIFACTS);
  }),
];
