// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { AGENTS, APPROVALS, EVIDENCE, RUNS, WORK_ITEMS } from '@/mocks/fixtures/demo';
import { buildMockWorkflows } from '@/mocks/fixtures/workflows';
import { MOCK_USERS } from '@/mocks/fixtures/users';

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function routeResponse(pathname: string): Response {
  if (pathname === '/v1/workspaces') {
    return json({
      items: [
        { workspaceId: 'ws-demo', name: 'Demo Workspace' },
        { workspaceId: 'ws-meridian', name: 'Meridian Workspace' },
      ],
    });
  }

  if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
    return json({ items: APPROVALS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
    return json({ items: EVIDENCE });
  }

  if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
    return json({ items: RUNS });
  }

  const runMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/runs\/([^/]+)\/?$/);
  const runId = runMatch?.[1];
  if (runId) {
    const run = RUNS.find((item) => item.runId === runId);
    return run ? json(run) : json({ error: 'not-found' }, 404);
  }

  if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
    return json({ items: WORK_ITEMS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/users$/.test(pathname)) {
    return json({ items: MOCK_USERS });
  }

  if (/^\/v1\/workspaces\/[^/]+\/workflows$/.test(pathname)) {
    return json({ items: WORKFLOWS });
  }

  const workflowMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/workflows\/([^/]+)\/?$/);
  const workflowId = workflowMatch?.[1];
  if (workflowId) {
    const workflow = WORKFLOWS.find((item) => item.workflowId === workflowId);
    return workflow ? json(workflow) : json({ error: 'not-found' }, 404);
  }

  const planMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/plans\/([^/]+)\/?$/);
  if (planMatch?.[1]) {
    return json({
      planId: planMatch[1],
      plannedEffects: [],
      predictedEffects: [],
    });
  }

  return json({ error: 'unhandled-endpoint', pathname }, 404);
}

function matchMediaStub(query: string): MediaQueryList {
  const maxMatch = query.match(/\(max-width:\s*(\d+)px\)/);
  const minMatch = query.match(/\(min-width:\s*(\d+)px\)/);
  const max = maxMatch ? Number(maxMatch[1]) : undefined;
  const min = minMatch ? Number(minMatch[1]) : undefined;
  const width = window.innerWidth;
  const matches = (max === undefined || width <= max) && (min === undefined || width >= min);

  return {
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 844,
  });

  vi.stubGlobal('matchMedia', matchMediaStub);
  vi.stubGlobal('localStorage', createMemoryStorage());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
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

describe('cockpit mobile shell', () => {
  it('renders bottom navigation and context controls in More drawer', async () => {
    const user = userEvent.setup();
    await renderRoute('/runs');

    expect(await screen.findByRole('heading', { name: 'Runs' })).toBeTruthy();
    expect(screen.queryByLabelText('Primary navigation')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open more navigation' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Open more navigation' }));

    expect(await screen.findByText('Navigation')).toBeTruthy();
    expect(screen.getByLabelText('Mobile persona')).toBeTruthy();
    expect(screen.getByLabelText('Mobile workspace')).toBeTruthy();
  });

  it.each([
    { path: '/approvals', heading: 'Approvals' },
    { path: '/work-items', heading: 'Work Items' },
    { path: '/runs', heading: 'Runs' },
    { path: '/workflows', heading: 'Workflows' },
  ])('keeps core mobile flow usable for $path', async ({ path, heading }) => {
    await renderRoute(path);

    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open more navigation' })).toBeTruthy();
    expect(document.getElementById('main-content')?.className.includes('overflow-x-hidden')).toBe(
      true,
    );
  });

  it('keeps workflow builder entry visible on phone viewports', async () => {
    await renderRoute('/workflows');

    expect(await screen.findByRole('link', { name: 'New Workflow' })).toBeTruthy();
  });
});
