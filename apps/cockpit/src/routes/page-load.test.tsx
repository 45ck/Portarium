// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { createCockpitRouter } from '@/router'
import { queryClient } from '@/lib/query-client'
import {
  ADAPTERS,
  AGENTS,
  APPROVALS,
  APPROVAL_THRESHOLDS,
  ESTOP_AUDIT_LOG,
  EVIDENCE,
  MISSIONS,
  OBSERVABILITY_DATA,
  ROBOTS,
  RUNS,
  SAFETY_CONSTRAINTS,
  WORKFORCE_MEMBERS,
  WORKFORCE_QUEUES,
  WORK_ITEMS,
} from '@/mocks/fixtures/demo'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function routeResponse(pathname: string, init?: RequestInit): Response {
  if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
    return json({ items: WORK_ITEMS })
  }

  const workItemMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/work-items\/([^/]+)$/)
  const workItemId = workItemMatch?.[1]
  if (workItemId) {
    const workItem = WORK_ITEMS.find((item) => item.workItemId === workItemId)
    return workItem ? json(workItem) : json({ error: 'not-found' }, 404)
  }

  if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
    return json({ items: RUNS })
  }

  const runMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/runs\/([^/]+)$/)
  const runId = runMatch?.[1]
  if (runId) {
    const run = RUNS.find((item) => item.runId === runId)
    return run ? json(run) : json({ error: 'not-found' }, 404)
  }

  if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
    return json({ items: APPROVALS })
  }

  const approvalDecisionMatch = pathname.match(
    /^\/v1\/workspaces\/[^/]+\/approvals\/([^/]+)\/decision$/,
  )
  const approvalDecisionId = approvalDecisionMatch?.[1]
  if (approvalDecisionId && init?.method === 'POST') {
    const approval = APPROVALS.find((item) => item.approvalId === approvalDecisionId)
    return approval ? json({ ...approval, status: 'Approved' }) : json({ error: 'not-found' }, 404)
  }

  const approvalMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/approvals\/([^/]+)$/)
  const approvalId = approvalMatch?.[1]
  if (approvalId) {
    const approval = APPROVALS.find((item) => item.approvalId === approvalId)
    return approval ? json(approval) : json({ error: 'not-found' }, 404)
  }

  if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
    return json({ items: EVIDENCE })
  }

  if (/^\/v1\/workspaces\/[^/]+\/workforce\/members$/.test(pathname)) {
    return json({ items: WORKFORCE_MEMBERS })
  }

  if (/^\/v1\/workspaces\/[^/]+\/workforce\/queues$/.test(pathname)) {
    return json({ items: WORKFORCE_QUEUES })
  }

  if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(pathname)) {
    return json({ items: AGENTS })
  }

  if (/^\/v1\/workspaces\/[^/]+\/adapters$/.test(pathname)) {
    return json({ items: ADAPTERS })
  }

  if (/^\/v1\/workspaces\/[^/]+\/observability$/.test(pathname)) {
    return json(OBSERVABILITY_DATA)
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/robots$/.test(pathname)) {
    return json({ items: ROBOTS })
  }

  const robotMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/robotics\/robots\/([^/]+)$/)
  const robotId = robotMatch?.[1]
  if (robotId) {
    const robot = ROBOTS.find((item) => item.robotId === robotId)
    return robot ? json(robot) : json({ error: 'not-found' }, 404)
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/missions$/.test(pathname)) {
    return json({ items: MISSIONS })
  }

  const missionMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/robotics\/missions\/([^/]+)$/)
  const missionId = missionMatch?.[1]
  if (missionId) {
    const mission = MISSIONS.find((item) => item.missionId === missionId)
    return mission ? json(mission) : json({ error: 'not-found' }, 404)
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/constraints$/.test(pathname)) {
    return json({ items: SAFETY_CONSTRAINTS })
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/thresholds$/.test(pathname)) {
    return json({ items: APPROVAL_THRESHOLDS })
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/estop-log$/.test(pathname)) {
    return json({ items: ESTOP_AUDIT_LOG })
  }

  return json({ error: 'unhandled-endpoint', pathname }, 404)
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  render(<RouterProvider router={router} />)
  await router.load()
}

const PAGE_CASES = [
  { path: '/', heading: 'Inbox' },
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/inbox', heading: 'Inbox' },
  { path: '/work-items', heading: 'Work Items' },
  { path: '/work-items/wi-1001', heading: 'Invoice mismatch: requires remediation approval' },
  { path: '/runs', heading: 'Runs' },
  { path: '/runs/run-2001', heading: 'Run: run-2001' },
  { path: '/approvals', heading: 'Approvals' },
  { path: '/approvals/apr-3001', heading: 'Approval Request' },
  { path: '/evidence', heading: 'Evidence' },
  { path: '/workforce', heading: 'Workforce' },
  { path: '/workforce/wfm-001', heading: 'Dana Approver' },
  { path: '/workforce/queues', heading: 'Queues' },
  { path: '/config/agents', heading: 'Agents' },
  { path: '/config/adapters', heading: 'Adapters' },
  { path: '/config/settings', heading: 'Settings' },
  { path: '/explore/objects', heading: 'Objects' },
  { path: '/explore/events', heading: 'Events' },
  { path: '/explore/observability', heading: 'Observability' },
  { path: '/explore/governance', heading: 'Governance' },
  { path: '/robotics', heading: 'Robotics' },
  { path: '/robotics/robots', heading: 'Robots' },
  { path: '/robotics/missions', heading: 'Missions' },
  { path: '/robotics/safety', heading: 'Safety & E-Stop' },
  { path: '/robotics/gateways', heading: 'Gateways' },
] as const

beforeAll(() => {
  vi.stubGlobal('localStorage', createMemoryStorage())
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const url = new URL(rawUrl, 'http://localhost')
    return Promise.resolve(routeResponse(url.pathname, init))
  })
})

beforeEach(() => {
  queryClient.clear()
  localStorage.clear()
  document.documentElement.className = ''
})

afterEach(() => {
  cleanup()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('cockpit route page-load smoke', () => {
  it.each(PAGE_CASES)('renders %s', async ({ path, heading }) => {
    await renderRoute(path)

    expect(await screen.findByText('Portarium')).toBeTruthy()
    expect((await screen.findAllByText('ws-demo')).length).toBeGreaterThan(0)
    expect((await screen.findAllByRole('heading', { name: heading })).length).toBeGreaterThan(0)
  })
})
