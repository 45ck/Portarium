// @vitest-environment jsdom
/**
 * Presentation V&V: workflow editor and operations cockpit E2E behavior
 * across roles and tenant scopes (bead-0762).
 *
 * Covers:
 *  1. canAccess role-gate matrix for new features
 *  2. Persona-aware default redirect from "/"
 *  3. Workflow edit controls gated by persona
 *  4. Multi-workspace tenant scoping (workspace ID in API paths)
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useUIStore } from '@/stores/ui-store';
import { canAccess } from '@/lib/role-gate';
import { AGENTS, APPROVALS, EVIDENCE, RUNS } from '@/mocks/fixtures/demo';
import { buildMockWorkflows } from '@/mocks/fixtures/workflows';
import type { PersonaId } from '@/stores/ui-store';

const WORKFLOWS = buildMockWorkflows(RUNS, AGENTS);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

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

/**
 * Minimal fetch mock that handles all routes used across these tests.
 * Records which workspace IDs appear in the request paths.
 */
function createFetchMock(capturedPaths?: string[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (capturedPaths) capturedPaths.push(pathname);

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({
          items: [
            { workspaceId: 'ws-demo', name: 'Demo Workspace' },
            { workspaceId: 'ws-meridian', name: 'Meridian Workspace' },
          ],
        }),
      );
    }
    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: APPROVALS }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
      return Promise.resolve(json({ items: EVIDENCE }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
      return Promise.resolve(json({ items: RUNS }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/workflows$/.test(pathname)) {
      return Promise.resolve(json({ items: WORKFLOWS }));
    }
    const workflowMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/workflows\/([^/]+)$/);
    if (workflowMatch) {
      const wf = WORKFLOWS.find((w) => w.workflowId === workflowMatch[1]);
      return Promise.resolve(wf ? json(wf) : json({ error: 'not-found' }, 404));
    }
    if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce\/members$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce\/queues$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/human-tasks$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/adapters$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/credential-grants$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/observability$/.test(pathname)) {
      return Promise.resolve(json({}));
    }
    if (/^\/v1\/workspaces\/[^/]+\/pack-ui-runtime$/.test(pathname)) {
      return Promise.resolve(json({}));
    }
    return Promise.resolve(json({ error: 'unhandled', pathname }, 404));
  });
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
}

// ---------------------------------------------------------------------------
// Test setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
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
});

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
  // Reset persona to Operator (default) before each test.
  useUIStore.getState().setActivePersona('Operator');
  useUIStore.getState().setActiveWorkspaceId('ws-meridian');
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Role-gate access matrix
// ---------------------------------------------------------------------------

describe('canAccess role-gate matrix', () => {
  const cases: Array<{
    persona: PersonaId;
    feature: Parameters<typeof canAccess>[1];
    expected: boolean;
  }> = [
    { persona: 'Admin', feature: 'workflows:edit', expected: true },
    { persona: 'Operator', feature: 'workflows:edit', expected: true },
    { persona: 'Approver', feature: 'workflows:edit', expected: false },
    { persona: 'Auditor', feature: 'workflows:edit', expected: false },
    { persona: 'Admin', feature: 'workforce:edit', expected: true },
    { persona: 'Operator', feature: 'workforce:edit', expected: false },
    { persona: 'Approver', feature: 'workforce:edit', expected: false },
    { persona: 'Auditor', feature: 'workforce:edit', expected: false },
    { persona: 'Admin', feature: 'approvals', expected: true },
    { persona: 'Approver', feature: 'approvals', expected: true },
    { persona: 'Operator', feature: 'approvals', expected: false },
    { persona: 'Auditor', feature: 'approvals', expected: false },
  ];

  it.each(cases)('$persona can access $feature: $expected', ({ persona, feature, expected }) => {
    expect(canAccess(persona, feature)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// 2. Persona-aware default redirect from "/"
// ---------------------------------------------------------------------------

describe('persona-aware default redirect', () => {
  it('Operator redirects to /inbox', async () => {
    useUIStore.getState().setActivePersona('Operator');
    await renderRoute('/');
    expect((await screen.findAllByRole('heading', { name: 'Inbox' })).length).toBeGreaterThan(0);
  });

  it('Approver redirects to /approvals', async () => {
    useUIStore.getState().setActivePersona('Approver');
    await renderRoute('/');
    expect((await screen.findAllByRole('heading', { name: 'Approvals' })).length).toBeGreaterThan(
      0,
    );
  });

  it('Auditor redirects to /evidence', async () => {
    useUIStore.getState().setActivePersona('Auditor');
    await renderRoute('/');
    expect((await screen.findAllByRole('heading', { name: 'Evidence' })).length).toBeGreaterThan(0);
  });

  it('Admin redirects to /dashboard', async () => {
    useUIStore.getState().setActivePersona('Admin');
    await renderRoute('/');
    expect((await screen.findAllByRole('heading', { name: 'Dashboard' })).length).toBeGreaterThan(
      0,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Workflow edit controls gated by persona
// ---------------------------------------------------------------------------

describe('workflow list - edit control gating', () => {
  it('Operator sees Edit button and New Workflow action', async () => {
    useUIStore.getState().setActivePersona('Operator');
    await renderRoute('/workflows');

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
    // Edit column present
    expect(screen.getAllByRole('link', { name: 'Edit' }).length).toBeGreaterThan(0);
    // New Workflow button present
    expect(screen.getByRole('link', { name: 'New Workflow' })).toBeTruthy();
  });

  it('Admin sees Edit button and New Workflow action', async () => {
    useUIStore.getState().setActivePersona('Admin');
    await renderRoute('/workflows');

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Edit' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'New Workflow' })).toBeTruthy();
  });

  it('Auditor does not see Edit button or New Workflow action', async () => {
    useUIStore.getState().setActivePersona('Auditor');
    await renderRoute('/workflows');

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
    expect(screen.queryAllByRole('link', { name: 'Edit' })).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'New Workflow' })).toBeNull();
  });

  it('Approver does not see Edit button or New Workflow action', async () => {
    useUIStore.getState().setActivePersona('Approver');
    await renderRoute('/workflows');

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
    expect(screen.queryAllByRole('link', { name: 'Edit' })).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'New Workflow' })).toBeNull();
  });
});

describe('workflow detail - edit control gating', () => {
  const WORKFLOW_ID = 'wf-invoice-remediation';

  it('Operator sees Edit Workflow button on detail page', async () => {
    useUIStore.getState().setActivePersona('Operator');
    await renderRoute(`/workflows/${WORKFLOW_ID}`);

    expect(await screen.findByRole('heading', { name: `Workflow: ${WORKFLOW_ID}` })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit Workflow' })).toBeTruthy();
  });

  it('Admin sees Edit Workflow button on detail page', async () => {
    useUIStore.getState().setActivePersona('Admin');
    await renderRoute(`/workflows/${WORKFLOW_ID}`);

    expect(await screen.findByRole('heading', { name: `Workflow: ${WORKFLOW_ID}` })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit Workflow' })).toBeTruthy();
  });

  it('Auditor does not see Edit Workflow button on detail page', async () => {
    useUIStore.getState().setActivePersona('Auditor');
    await renderRoute(`/workflows/${WORKFLOW_ID}`);

    expect(await screen.findByRole('heading', { name: `Workflow: ${WORKFLOW_ID}` })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit Workflow' })).toBeNull();
  });

  it('Approver does not see Edit Workflow button on detail page', async () => {
    useUIStore.getState().setActivePersona('Approver');
    await renderRoute(`/workflows/${WORKFLOW_ID}`);

    expect(await screen.findByRole('heading', { name: `Workflow: ${WORKFLOW_ID}` })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit Workflow' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Multi-workspace tenant scoping
// ---------------------------------------------------------------------------

describe('multi-workspace tenant scoping', () => {
  it('API calls include the active workspaceId in the path', async () => {
    const capturedPaths: string[] = [];
    vi.stubGlobal('fetch', createFetchMock(capturedPaths));

    useUIStore.getState().setActiveWorkspaceId('ws-meridian');
    await renderRoute('/workflows');
    await screen.findByRole('heading', { name: 'Workflows' });

    const workflowPaths = capturedPaths.filter((p) => /\/workflows/.test(p));
    expect(workflowPaths.every((p) => p.includes('/ws-meridian/'))).toBe(true);
  });

  it('switching workspace causes requests with a different workspaceId', async () => {
    const capturedPaths: string[] = [];
    vi.stubGlobal('fetch', createFetchMock(capturedPaths));

    // First load with ws-demo
    useUIStore.getState().setActiveWorkspaceId('ws-demo');
    await renderRoute('/workflows');
    await screen.findByRole('heading', { name: 'Workflows' });

    const pathsForDemo = capturedPaths.filter((p) => p.includes('/ws-demo/'));
    expect(pathsForDemo.length).toBeGreaterThan(0);

    // Verify ws-meridian never appeared
    expect(capturedPaths.some((p) => p.includes('/ws-meridian/'))).toBe(false);
  });
});
