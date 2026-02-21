// @vitest-environment jsdom

/**
 * Regression test for the map sidebar layout bug.
 *
 * Root cause: the `.relative.flex-1` wrapper around the ResizablePanelGroup
 * does not have `min-h-0`, so the default `min-height: auto` in flexbox
 * prevents it from shrinking below its content height. This causes:
 *   1. The PanelGroup overflows the viewport (1217px instead of ~835px).
 *   2. react-resizable-panels mis-calculates widths (~4% instead of 28%).
 *   3. The sidebar is crushed to ~45px, making robot cards unreadable.
 *
 * The fix is `min-h-0` on the flex-1 container so the PanelGroup is
 * constrained to the available viewport height.
 */
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

// URL prefix for workspace-scoped API requests
const WS = /^\/v1\/workspaces\/[^/]+/;

function routeResponse(pathname: string): Response {
  if (new RegExp(WS.source + '/robotics/robot-locations$').test(pathname))
    return json({ items: ROBOT_LOCATIONS, geofences: GEOFENCES, alerts: SPATIAL_ALERTS });
  if (new RegExp(WS.source + '/robotics/robots$').test(pathname)) return json({ items: ROBOTS });
  if (new RegExp(WS.source + '/robotics/robots/[^/]+$').test(pathname)) {
    const id = pathname.split('/').pop()!;
    const robot = ROBOTS.find((r) => r.robotId === id);
    return robot ? json(robot) : json({ error: 'not-found' }, 404);
  }
  if (new RegExp(WS.source + '/robotics/missions$').test(pathname))
    return json({ items: MISSIONS });
  if (new RegExp(WS.source + '/robotics/missions/[^/]+$').test(pathname)) {
    const id = pathname.split('/').pop()!;
    const mission = MISSIONS.find((m) => m.missionId === id);
    return mission ? json(mission) : json({ error: 'not-found' }, 404);
  }
  if (new RegExp(WS.source + '/robotics/safety/constraints$').test(pathname))
    return json({ items: SAFETY_CONSTRAINTS });
  if (new RegExp(WS.source + '/robotics/safety/thresholds$').test(pathname))
    return json({ items: APPROVAL_THRESHOLDS });
  if (new RegExp(WS.source + '/robotics/safety/estop-log$').test(pathname))
    return json({ items: ESTOP_AUDIT_LOG });
  if (new RegExp(WS.source + '/robotics/gateways$').test(pathname))
    return json({ items: MOCK_GATEWAYS });
  if (new RegExp(WS.source + '/work-items$').test(pathname)) return json({ items: WORK_ITEMS });
  if (new RegExp(WS.source + '/runs$').test(pathname)) return json({ items: RUNS });
  if (new RegExp(WS.source + '/workflows$').test(pathname)) return json({ items: WORKFLOWS });
  if (new RegExp(WS.source + '/approvals$').test(pathname)) return json({ items: APPROVALS });
  if (new RegExp(WS.source + '/evidence$').test(pathname)) return json({ items: EVIDENCE });
  if (new RegExp(WS.source + '/workforce/members$').test(pathname))
    return json({ items: WORKFORCE_MEMBERS });
  if (new RegExp(WS.source + '/workforce/queues$').test(pathname))
    return json({ items: WORKFORCE_QUEUES });
  if (new RegExp(WS.source + '/agents$').test(pathname)) return json({ items: AGENTS });
  if (new RegExp(WS.source + '/adapters$').test(pathname)) return json({ items: ADAPTERS });
  if (new RegExp(WS.source + '/credential-grants$').test(pathname))
    return json({ items: CREDENTIAL_GRANTS });
  if (new RegExp(WS.source + '/human-tasks$').test(pathname)) return json({ items: HUMAN_TASKS });
  if (new RegExp(WS.source + '/observability$').test(pathname)) return json(OBSERVABILITY_DATA);
  if (new RegExp(WS.source + '/users$').test(pathname)) return json({ items: MOCK_USERS });
  if (new RegExp(WS.source + '/policies$').test(pathname)) return json({ items: MOCK_POLICIES });
  if (new RegExp(WS.source + '/sod-constraints$').test(pathname))
    return json({ items: MOCK_SOD_CONSTRAINTS });
  return json({ error: 'unhandled', pathname }, 404);
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
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
    return Promise.resolve(routeResponse(url.pathname));
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

describe('map sidebar layout', () => {
  it('map content wrapper has min-h-0 so flexbox does not overflow the viewport', async () => {
    const router = createCockpitRouter({
      history: createMemoryHistory({ initialEntries: ['/robotics/map'] }),
    });
    const { container } = render(<RouterProvider router={router} />);
    await router.load();

    // Wait for the map page to fully render (async data fetching + component mount).
    // The heading has role="heading" with text "Operations Map".
    await screen.findByRole('heading', { name: 'Operations Map' }, { timeout: 5000 });

    // The map page's flex-1 wrapper around the ResizablePanelGroup must have
    // min-height: 0 (via `min-h-0`) to prevent flexbox overflow.
    // Without it, the default `min-height: auto` causes the panel group to
    // exceed the viewport height, which breaks ResizablePanel width calculations.
    const panelGroup = container.querySelector('[data-slot="resizable-panel-group"]');
    expect(panelGroup).toBeTruthy();

    // Walk up to find the flex-1 parent that wraps the panel group
    const flexWrapper = panelGroup!.parentElement;
    expect(flexWrapper).toBeTruthy();
    expect(flexWrapper!.classList.contains('min-h-0')).toBe(true);
  });
});
