import { http, HttpResponse } from 'msw'
import {
  WORK_ITEMS,
  RUNS,
  APPROVALS,
  EVIDENCE,
  WORKFORCE_MEMBERS,
  WORKFORCE_QUEUES,
  AGENTS,
  ADAPTERS,
  OBSERVABILITY_DATA,
  ROBOTS,
  MISSIONS,
  SAFETY_CONSTRAINTS,
  APPROVAL_THRESHOLDS,
  ESTOP_AUDIT_LOG,
} from './fixtures/demo'
import type { ApprovalDecisionRequest } from '@portarium/cockpit-types'

// In-memory mutable state for mutation demo
let approvals = [...APPROVALS]

export const handlers = [
  // Work Items
  http.get('/v1/workspaces/:wsId/work-items', () =>
    HttpResponse.json({ items: WORK_ITEMS }),
  ),
  http.get('/v1/workspaces/:wsId/work-items/:wiId', ({ params }) => {
    const item = WORK_ITEMS.find((w) => w.workItemId === params['wiId'])
    if (!item) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(item)
  }),

  // Runs
  http.get('/v1/workspaces/:wsId/runs', () =>
    HttpResponse.json({ items: RUNS }),
  ),
  http.get('/v1/workspaces/:wsId/runs/:runId', ({ params }) => {
    const run = RUNS.find((r) => r.runId === params['runId'])
    if (!run) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(run)
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
              decidedByUserId: 'user-approver-dana',
              rationale: body.rationale,
            }
          : a,
      )
      const updated = approvals.find((a) => a.approvalId === params['id'])
      return HttpResponse.json(updated)
    },
  ),

  // Evidence
  http.get('/v1/workspaces/:wsId/evidence', () =>
    HttpResponse.json({ items: EVIDENCE }),
  ),

  // Workforce
  http.get('/v1/workspaces/:wsId/workforce/members', () =>
    HttpResponse.json({ items: WORKFORCE_MEMBERS }),
  ),
  http.get('/v1/workspaces/:wsId/workforce/queues', () =>
    HttpResponse.json({ items: WORKFORCE_QUEUES }),
  ),

  // Agents
  http.get('/v1/workspaces/:wsId/agents', () =>
    HttpResponse.json({ items: AGENTS }),
  ),

  // Adapters
  http.get('/v1/workspaces/:wsId/adapters', () =>
    HttpResponse.json({ items: ADAPTERS }),
  ),

  // Observability
  http.get('/v1/workspaces/:wsId/observability', () =>
    HttpResponse.json(OBSERVABILITY_DATA),
  ),

  // Robotics — Robots
  http.get('/v1/workspaces/:wsId/robotics/robots', () =>
    HttpResponse.json({ items: ROBOTS }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/robots/:robotId', ({ params }) => {
    const robot = ROBOTS.find((r) => r.robotId === params['robotId'])
    if (!robot) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(robot)
  }),

  // Robotics — Missions
  http.get('/v1/workspaces/:wsId/robotics/missions', () =>
    HttpResponse.json({ items: MISSIONS }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/missions/:missionId', ({ params }) => {
    const mission = MISSIONS.find((m) => m.missionId === params['missionId'])
    if (!mission) return HttpResponse.json(null, { status: 404 })
    return HttpResponse.json(mission)
  }),

  // Robotics — Safety
  http.get('/v1/workspaces/:wsId/robotics/safety/constraints', () =>
    HttpResponse.json({ items: SAFETY_CONSTRAINTS }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/safety/thresholds', () =>
    HttpResponse.json({ items: APPROVAL_THRESHOLDS }),
  ),
  http.get('/v1/workspaces/:wsId/robotics/safety/estop-log', () =>
    HttpResponse.json({ items: ESTOP_AUDIT_LOG }),
  ),
]
