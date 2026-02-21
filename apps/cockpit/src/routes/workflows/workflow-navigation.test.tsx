// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { AGENTS, RUNS } from '@/mocks/fixtures/demo';
import { buildMockWorkflows } from '@/mocks/fixtures/workflows';

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

function createFetchMock() {
  const workflows = buildMockWorkflows(RUNS, AGENTS);

  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({
          items: [{ workspaceId: 'ws-meridian', name: 'Meridian Workspace' }],
        }),
      );
    }

    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
      return Promise.resolve(json({ items: RUNS }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/workflows$/.test(pathname)) {
      return Promise.resolve(json({ items: workflows }));
    }

    const workflowMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/workflows\/([^/]+)$/);
    const workflowId = workflowMatch?.[1];
    if (workflowId) {
      const workflow = workflows.find((item) => item.workflowId === workflowId);
      return Promise.resolve(workflow ? json(workflow) : json({ error: 'not-found' }, 404));
    }

    return Promise.resolve(json({ error: 'unhandled-endpoint', pathname }, 404));
  });
}

async function renderRoute(path: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

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
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('workflow navigation links', () => {
  it('supports list/detail/edit navigation with clear controls', async () => {
    await renderRoute('/workflows');

    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Workflow' })).toBeTruthy();
    const workflowLink = await screen.findByRole('link', { name: 'wf-invoice-remediation' });
    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);

    fireEvent.click(workflowLink);
    expect(
      await screen.findByRole('heading', { name: 'Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit Workflow' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Edit Workflow' }));
    expect(
      await screen.findByRole('heading', { name: 'Edit Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Detail' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Workflows' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Detail' }));
    expect(
      await screen.findByRole('heading', { name: 'Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'Edit Workflow' }));
    expect(
      await screen.findByRole('heading', { name: 'Edit Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Back to Workflows' }));
    expect(await screen.findByRole('heading', { name: 'Workflows' })).toBeTruthy();

    fireEvent.click(screen.getByRole('link', { name: 'New Workflow' }));
    expect(await screen.findByRole('heading', { name: 'Workflow Builder' })).toBeTruthy();
  });
});
