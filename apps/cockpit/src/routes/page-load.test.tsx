// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import {
  ADAPTERS,
  AGENTS,
  APPROVALS,
  APPROVAL_THRESHOLDS,
  CREDENTIAL_GRANTS,
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
} from '@/mocks/fixtures/demo';
import { buildMockWorkflows } from '@/mocks/fixtures/workflows';
import { buildMockHumanTasks } from '@/mocks/fixtures/human-tasks';
import { ROBOT_LOCATIONS, GEOFENCES, SPATIAL_ALERTS } from '@/mocks/fixtures/robot-locations';
import { MOCK_USERS } from '@/mocks/fixtures/users';
import { MOCK_POLICIES, MOCK_SOD_CONSTRAINTS } from '@/mocks/fixtures/policies';
import { MOCK_GATEWAYS } from '@/mocks/fixtures/gateways';

const HUMAN_TASKS = buildMockHumanTasks(RUNS, WORK_ITEMS, WORKFORCE_MEMBERS);

const WORKFLOWS = buildMockWorkflows(RUNS, AGENTS);

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function routeResponse(pathname: string, init?: RequestInit): Response {
  if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
    return json({ items: WORK_ITEMS });
  }

  const workItemMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/work-items\/([^/]+)$/);
  const workItemId = workItemMatch?.[1];
  if (workItemId) {
    const workItem = WORK_ITEMS.find((item) => item.workItemId === workItemId);
    return workItem ? json(workItem) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
    return json({ items: RUNS });
  }

  const runMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/runs\/([^/]+)$/);
  const runId = runMatch?.[1];
  if (runId) {
    const run = RUNS.find((item) => item.runId === runId);
    return run ? json(run) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/workflows$/.test(pathname)) {
    return json({ items: WORKFLOWS });
  }

  const workflowMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/workflows\/([^/]+)$/);
  const workflowId = workflowMatch?.[1];
  if (workflowId) {
    const workflow = WORKFLOWS.find((item) => item.workflowId === workflowId);
    return workflow ? json(workflow) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
    return json({ items: APPROVALS });
  }

  const approvalDecisionMatch = pathname.match(
    /^\/v1\/workspaces\/[^/]+\/approvals\/([^/]+)\/decision$/,
  );
  const approvalDecisionId = approvalDecisionMatch?.[1];
  if (approvalDecisionId && init?.method === 'POST') {
    const approval = APPROVALS.find((item) => item.approvalId === approvalDecisionId);
    return approval ? json({ ...approval, status: 'Approved' }) : json({ error: 'not-found' }, 404);
  }

  const approvalMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/approvals\/([^/]+)$/);
  const approvalId = approvalMatch?.[1];
  if (approvalId) {
    const approval = APPROVALS.find((item) => item.approvalId === approvalId);
    return approval ? json(approval) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
    return json({ items: EVIDENCE });
  }

  if (/^\/v1\/workspaces\/[^/]+\/workforce\/members$/.test(pathname)) {
    return json({ items: WORKFORCE_MEMBERS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/workforce\/queues$/.test(pathname)) {
    return json({ items: WORKFORCE_QUEUES });
  }

  if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(pathname)) {
    return json({ items: AGENTS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/adapters$/.test(pathname)) {
    return json({ items: ADAPTERS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/credential-grants$/.test(pathname)) {
    return json({ items: CREDENTIAL_GRANTS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/human-tasks$/.test(pathname)) {
    return json({ items: HUMAN_TASKS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/observability$/.test(pathname)) {
    return json(OBSERVABILITY_DATA);
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/robot-locations$/.test(pathname)) {
    return json({ items: ROBOT_LOCATIONS, geofences: GEOFENCES, alerts: SPATIAL_ALERTS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/robots$/.test(pathname)) {
    return json({ items: ROBOTS });
  }

  const robotMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/robotics\/robots\/([^/]+)$/);
  const robotId = robotMatch?.[1];
  if (robotId) {
    const robot = ROBOTS.find((item) => item.robotId === robotId);
    return robot ? json(robot) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/missions$/.test(pathname)) {
    return json({ items: MISSIONS });
  }

  const missionMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/robotics\/missions\/([^/]+)$/);
  const missionId = missionMatch?.[1];
  if (missionId) {
    const mission = MISSIONS.find((item) => item.missionId === missionId);
    return mission ? json(mission) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/constraints$/.test(pathname)) {
    return json({ items: SAFETY_CONSTRAINTS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/thresholds$/.test(pathname)) {
    return json({ items: APPROVAL_THRESHOLDS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/safety\/estop-log$/.test(pathname)) {
    return json({ items: ESTOP_AUDIT_LOG });
  }

  if (/^\/v1\/workspaces\/[^/]+\/users$/.test(pathname)) {
    return json({ items: MOCK_USERS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/policies$/.test(pathname)) {
    return json({ items: MOCK_POLICIES });
  }

  if (/^\/v1\/workspaces\/[^/]+\/sod-constraints$/.test(pathname)) {
    return json({ items: MOCK_SOD_CONSTRAINTS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/robotics\/gateways$/.test(pathname)) {
    return json({ items: MOCK_GATEWAYS });
  }

  return json({ error: 'unhandled-endpoint', pathname }, 404);
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router} />);
  await router.load();
}

const PAGE_CASES = [
  { path: '/', heading: 'Inbox' },
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/inbox', heading: 'Inbox' },
  { path: '/work-items', heading: 'Work Items' },
  { path: '/work-items/wi-1001', heading: 'Invoice mismatch: requires remediation approval' },
  { path: '/runs', heading: 'Runs' },
  { path: '/runs/run-2001', heading: 'Run: run-2001' },
  { path: '/workflows', heading: 'Workflows' },
  { path: '/workflows/wf-invoice-remediation', heading: 'Workflow: wf-invoice-remediation' },
  { path: '/workflows/builder', heading: 'Workflow Builder' },
  { path: '/approvals', heading: 'Approvals' },
  { path: '/approvals/apr-3001', heading: 'Approval Request' },
  { path: '/evidence', heading: 'Evidence' },
  { path: '/workforce', heading: 'Workforce' },
  { path: '/workforce/wfm-001', heading: 'Dana Approver' },
  { path: '/workforce/queues', heading: 'Queues' },
  { path: '/config/agents', heading: 'Agents' },
  { path: '/config/adapters', heading: 'Adapters' },
  { path: '/config/credentials', heading: 'Credentials' },
  { path: '/config/users', heading: 'Users' },
  { path: '/config/settings', heading: 'Settings' },
  { path: '/explore/objects', heading: 'Objects' },
  { path: '/explore/events', heading: 'Events' },
  { path: '/explore/observability', heading: 'Observability' },
  { path: '/explore/governance', heading: 'Governance' },
  { path: '/robotics', heading: 'Robotics' },
  { path: '/robotics/map', heading: 'Operations Map' },
  { path: '/robotics/robots', heading: 'Robots' },
  { path: '/robotics/missions', heading: 'Missions' },
  { path: '/robotics/safety', heading: 'Safety & E-Stop' },
  { path: '/robotics/gateways', heading: 'Gateways' },
] as const;

beforeAll(() => {
  // Set desktop viewport so useIsMobile() returns false and sidebar renders
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  // matchMedia stub for useIsMobile and useReducedMotion
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  }
  vi.stubGlobal('localStorage', createMemoryStorage());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    return Promise.resolve(routeResponse(url.pathname, init));
  });
});

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('cockpit route page-load smoke', () => {
  it.each(PAGE_CASES)('renders %s', async ({ path, heading }) => {
    await renderRoute(path);

    expect(await screen.findByText('Portarium')).toBeTruthy();
    // The workspace selector is a Radix Select whose value may not be
    // discoverable by `getByText` in jsdom.  Verify the sidebar rendered
    // by checking the Portarium logo text above.
    expect((await screen.findAllByRole('heading', { name: heading })).length).toBeGreaterThan(0);
  });
});
