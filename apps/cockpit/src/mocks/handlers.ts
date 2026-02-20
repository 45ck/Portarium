import { http, HttpResponse } from 'msw'
import type { MeridianDataset } from './fixtures/meridian-seed'
import type {
  ApprovalDecisionRequest,
  AssignHumanTaskRequest,
  CompleteHumanTaskRequest,
  EscalateHumanTaskRequest,
  CreateCredentialGrantRequest,
  CredentialGrantV1,
  HumanTaskSummary,
  UpdateWorkItemCommand,
} from '@portarium/cockpit-types'
import { buildMockWorkflows, findMockWorkflowById } from './fixtures/workflows'
import { buildMockHumanTasks } from './fixtures/human-tasks'
import { ROBOT_LOCATIONS, GEOFENCES, SPATIAL_ALERTS } from './fixtures/robot-locations'
import { MOCK_USERS, type UserSummary } from './fixtures/users'
import { MOCK_POLICIES, MOCK_SOD_CONSTRAINTS } from './fixtures/policies'
import { MOCK_GATEWAYS } from './fixtures/gateways'

// ---------------------------------------------------------------------------
// Mutable dataset reference — replaced at bootstrap via loadActiveDataset()
// ---------------------------------------------------------------------------

let data: MeridianDataset | null = null

// In-memory mutable state for mutation demo
let approvals: MeridianDataset['APPROVALS'] = []
let credentialGrants: CredentialGrantV1[] = []
let humanTasks: HumanTaskSummary[] = []
let workItems: MeridianDataset['WORK_ITEMS'] = []
let users: UserSummary[] = [...MOCK_USERS]
let agents: MeridianDataset['AGENTS'] = []
let runs: MeridianDataset['RUNS'] = []
let missions: MeridianDataset['MISSIONS'] = []

export async function loadActiveDataset(): Promise<void> {
  const { DATASETS } = await import('./fixtures/index')
  const stored = localStorage.getItem('portarium-dataset') ?? 'meridian-demo'
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const entry = (DATASETS.find((d) => d.id === stored) ?? DATASETS[0])!
  data = await entry.load()
  approvals = [...data.APPROVALS]
  workItems = [...data.WORK_ITEMS]
  credentialGrants = [...data.CREDENTIAL_GRANTS]
  humanTasks = buildMockHumanTasks(data.RUNS, data.WORK_ITEMS, data.WORKFORCE_MEMBERS)
  agents = [...data.AGENTS]
  runs = [...data.RUNS]
  missions = [...(data.MISSIONS ?? [])]
}

export const handlers = [
  // Work Items
  http.get('/v1/workspaces/:wsId/work-items', () =>
    HttpResponse.json({ items: workItems.length > 0 ? workItems : (data?.WORK_ITEMS ?? []) }),
  ),
  http.get('/v1/workspaces/:wsId/work-items/:wiId', ({ params }) => {
    const list = workItems.length > 0 ? workItems : (data?.WORK_ITEMS ?? [])
    const item = list.find((w) => w.workItemId === params['wiId'])
    if (!item) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(item)
  }),
  http.patch('/v1/workspaces/:wsId/work-items/:wiId', async ({ request, params }) => {
    const body = (await request.json()) as UpdateWorkItemCommand
    const wiId = String(params['wiId'] ?? '')
    workItems = workItems.map((w) =>
      w.workItemId === wiId ? { ...w, ...body } : w,
    )
    const updated = workItems.find((w) => w.workItemId === wiId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),

  // Runs
  http.get('/v1/workspaces/:wsId/runs', () =>
    HttpResponse.json({ items: runs }),
  ),
  http.get('/v1/workspaces/:wsId/runs/:runId', ({ params }) => {
    const run = runs.find((r) => r.runId === params['runId'])
    if (!run) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(run)
  }),
  http.post('/v1/workspaces/:wsId/runs', async ({ request, params }) => {
    const body = (await request.json()) as { workflowId: string; parameters?: Record<string, unknown> }
    const wsId = String(params['wsId'] ?? 'ws-demo')
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
    }
    runs = [newRun, ...runs]
    return HttpResponse.json(newRun, { status: 201 })
  }),
  http.post('/v1/workspaces/:wsId/runs/:runId/cancel', ({ params }) => {
    const runId = String(params['runId'] ?? '')
    runs = runs.map((r) =>
      r.runId === runId ? { ...r, status: 'Cancelled' as const, endedAtIso: new Date().toISOString() } : r,
    )
    const updated = runs.find((r) => r.runId === runId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),

  // Workflows
  http.get('/v1/workspaces/:wsId/workflows', () =>
    HttpResponse.json({ items: buildMockWorkflows(runs, agents) }),
  ),
  http.get('/v1/workspaces/:wsId/workflows/:workflowId', ({ params }) => {
    const workflow = findMockWorkflowById(
      runs,
      agents,
      String(params['workflowId'] ?? ''),
    )
    if (!workflow) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(workflow)
  }),

  // Approvals
  http.get('/v1/workspaces/:wsId/approvals', () =>
    HttpResponse.json({ items: approvals }),
  ),
  http.get('/v1/workspaces/:wsId/approvals/:id', ({ params }) => {
    const approval = approvals.find((a) => a.approvalId === params['id'])
    if (!approval) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(approval)
  }),
  http.post(
    '/v1/workspaces/:wsId/approvals/:id/decision',
    async ({ request, params }) => {
      const body = (await request.json()) as ApprovalDecisionRequest
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
      )
      const updated = approvals.find((a) => a.approvalId === params['id'])
      return HttpResponse.json(updated)
    },
  ),

  // Plans
  http.get('/v1/workspaces/:wsId/plans/:planId', ({ params }) => {
    const plan = data?.PLANS?.find((p) => p.planId === params['planId'])
    if (!plan) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(plan)
  }),

  // Evidence
  http.get('/v1/workspaces/:wsId/evidence', () =>
    HttpResponse.json({ items: data?.EVIDENCE ?? [] }),
  ),

  // Workforce
  http.get('/v1/workspaces/:wsId/workforce/members', () =>
    HttpResponse.json({ items: data?.WORKFORCE_MEMBERS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/workforce/queues', () =>
    HttpResponse.json({ items: data?.WORKFORCE_QUEUES ?? [] }),
  ),

  // Agents
  http.get('/v1/workspaces/:wsId/agents', () =>
    HttpResponse.json({ items: agents }),
  ),
  http.post('/v1/workspaces/:wsId/agents', async ({ request, params }) => {
    const body = (await request.json()) as { name: string; endpoint: string; modelId?: string; allowedCapabilities?: string[] }
    const wsId = String(params['wsId'] ?? 'ws-demo')
    const newAgent = {
      schemaVersion: 1 as const,
      agentId: `agent-${Date.now()}`,
      workspaceId: wsId,
      name: body.name,
      endpoint: body.endpoint,
      modelId: body.modelId,
      allowedCapabilities: (body.allowedCapabilities ?? []) as import('@portarium/cockpit-types').AgentCapability[],
      usedByWorkflowIds: [],
    }
    agents = [newAgent, ...agents]
    return HttpResponse.json(newAgent, { status: 201 })
  }),

  // Adapters
  http.get('/v1/workspaces/:wsId/adapters', () =>
    HttpResponse.json({ items: data?.ADAPTERS ?? [] }),
  ),

  // Credential grants
  http.get('/v1/workspaces/:wsId/credential-grants', () =>
    HttpResponse.json({ items: credentialGrants }),
  ),
  http.post('/v1/workspaces/:wsId/credential-grants', async ({ request, params }) => {
    const body = (await request.json()) as CreateCredentialGrantRequest
    const wsId = String(params['wsId'] ?? data?.RUNS[0]?.workspaceId ?? 'ws-demo')
    const nowIso = new Date().toISOString()
    const created: CredentialGrantV1 = {
      schemaVersion: 1,
      credentialGrantId: `cg-auto-${Date.now()}`,
      workspaceId: wsId,
      adapterId: body.adapterId,
      credentialsRef: body.credentialsRef,
      scope: body.scope,
      issuedAtIso: nowIso,
      ...(body.expiresAtIso ? { expiresAtIso: body.expiresAtIso } : {}),
    }
    credentialGrants = [created, ...credentialGrants]
    return HttpResponse.json(created, { status: 201 })
  }),
  http.post('/v1/workspaces/:wsId/credential-grants/:credentialGrantId/revoke', ({ params }) => {
    const credentialGrantId = String(params['credentialGrantId'] ?? '')
    const target = credentialGrants.find((grant) => grant.credentialGrantId === credentialGrantId)
    if (!target) return HttpResponse.json(null, { status: 404 })

    const revoked: CredentialGrantV1 = {
      ...target,
      revokedAtIso: new Date().toISOString(),
    }
    credentialGrants = credentialGrants.map((grant) =>
      grant.credentialGrantId === credentialGrantId ? revoked : grant,
    )
    return HttpResponse.json(revoked)
  }),

  // Human Tasks
  http.get('/v1/workspaces/:wsId/human-tasks', () =>
    HttpResponse.json({ items: humanTasks }),
  ),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/assign', async ({ request, params }) => {
    const body = (await request.json()) as AssignHumanTaskRequest
    const taskId = String(params['taskId'] ?? '')
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId
        ? { ...t, assigneeId: body.workforceMemberId, status: 'assigned' as const }
        : t,
    )
    const updated = humanTasks.find((t) => t.humanTaskId === taskId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/complete', async ({ params }) => {
    const taskId = String(params['taskId'] ?? '')
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId
        ? { ...t, status: 'completed' as const, completedAt: new Date().toISOString() }
        : t,
    )
    const updated = humanTasks.find((t) => t.humanTaskId === taskId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),
  http.post('/v1/workspaces/:wsId/human-tasks/:taskId/escalate', async ({ params }) => {
    const taskId = String(params['taskId'] ?? '')
    humanTasks = humanTasks.map((t) =>
      t.humanTaskId === taskId
        ? { ...t, status: 'escalated' as const }
        : t,
    )
    const updated = humanTasks.find((t) => t.humanTaskId === taskId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),

  // Observability
  http.get('/v1/workspaces/:wsId/observability', () =>
    HttpResponse.json(data?.OBSERVABILITY_DATA ?? {}),
  ),

  // Robotics — Robot Locations (map)
  http.get('/v1/workspaces/:wsId/robotics/robot-locations', () =>
    HttpResponse.json({ items: ROBOT_LOCATIONS, geofences: GEOFENCES, alerts: SPATIAL_ALERTS }),
  ),

  // Robotics — Robots
  http.get('/v1/workspaces/:wsId/robotics/robots', () =>
    HttpResponse.json({ items: data?.ROBOTS ?? [] }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/robots/:robotId', ({ params }) => {
    const robot = data?.ROBOTS.find((r) => r.robotId === params['robotId'])
    if (!robot) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(robot)
  }),

  // Robotics — Missions
  http.get('/v1/workspaces/:wsId/robotics/missions', () =>
    HttpResponse.json({ items: missions }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/missions/:missionId', ({ params }) => {
    const mission = missions.find((m) => m.missionId === params['missionId'])
    if (!mission) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(mission)
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/cancel', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Cancelled' as const } : m,
    )
    const updated = missions.find((m) => m.missionId === params['missionId'])
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/preempt', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Cancelled' as const } : m,
    )
    const updated = missions.find((m) => m.missionId === params['missionId'])
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),
  http.post('/v1/workspaces/:wsId/robotics/missions/:missionId/retry', ({ params }) => {
    missions = missions.map((m) =>
      m.missionId === params['missionId'] ? { ...m, status: 'Pending' as const } : m,
    )
    const updated = missions.find((m) => m.missionId === params['missionId'])
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
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
  http.post('/v1/workspaces/:wsId/robotics/safety/estop', () =>
    HttpResponse.json({ status: 'activated' }),
  ),
  http.delete('/v1/workspaces/:wsId/robotics/safety/estop', () =>
    HttpResponse.json({ status: 'cleared' }),
  ),

  // Users
  http.get('/v1/workspaces/:wsId/users', () =>
    HttpResponse.json({ items: users }),
  ),
  http.post('/v1/workspaces/:wsId/users/invite', async ({ request, params }) => {
    const body = (await request.json()) as { email: string; role: string }
    const wsId = String(params['wsId'] ?? 'ws-demo')
    const newUser: UserSummary = {
      userId: `user-${Date.now()}`,
      name: body.email.split('@')[0] ?? 'New User',
      email: body.email,
      role: body.role as UserSummary['role'],
      status: 'active',
      lastActiveIso: new Date().toISOString(),
    }
    users = [newUser, ...users]
    return HttpResponse.json(newUser, { status: 201 })
  }),
  http.patch('/v1/workspaces/:wsId/users/:userId', async ({ request, params }) => {
    const body = (await request.json()) as Partial<Pick<UserSummary, 'role' | 'status'>>
    const userId = String(params['userId'] ?? '')
    users = users.map((u) =>
      u.userId === userId ? { ...u, ...body } : u,
    )
    const updated = users.find((u) => u.userId === userId)
    if (!updated) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(updated)
  }),

  // Policies
  http.get('/v1/workspaces/:wsId/policies', () =>
    HttpResponse.json({ items: MOCK_POLICIES }),
  ),
  http.get('/v1/workspaces/:wsId/policies/:policyId', ({ params }) => {
    const policy = MOCK_POLICIES.find((p) => p.policyId === params['policyId'])
    if (!policy) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(policy)
  }),

  // SoD Constraints
  http.get('/v1/workspaces/:wsId/sod-constraints', () =>
    HttpResponse.json({ items: MOCK_SOD_CONSTRAINTS }),
  ),

  // Robotics — Gateways
  http.get('/v1/workspaces/:wsId/robotics/gateways', () =>
    HttpResponse.json({ items: MOCK_GATEWAYS }),
  ),
]
