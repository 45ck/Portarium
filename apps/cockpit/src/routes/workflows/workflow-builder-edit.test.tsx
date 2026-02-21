// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { AGENTS, RUNS } from '@/mocks/fixtures/demo';
import { buildMockWorkflows } from '@/mocks/fixtures/workflows';
import type { UpdateWorkflowRequest, WorkflowDetail } from '@portarium/cockpit-types';

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

function createFetchMock(options?: { failPatch?: boolean }) {
  const seed = buildMockWorkflows(RUNS, AGENTS).find(
    (workflow) => workflow.workflowId === 'wf-invoice-remediation',
  );
  if (!seed) throw new Error('seed workflow missing');

  let workflow: WorkflowDetail = structuredClone(seed);
  let lastPatchBody: UpdateWorkflowRequest | null = null;

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method =
      (typeof input === 'string' || input instanceof URL
        ? init?.method
        : (init?.method ?? input.method)) ?? 'GET';
    const normalizedMethod = method.toUpperCase();
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({
          items: [{ workspaceId: workflow.workspaceId, name: 'Meridian Workspace' }],
        }),
      );
    }

    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/workflows$/.test(pathname)) {
      return Promise.resolve(json({ items: [workflow] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
      return Promise.resolve(
        json({ items: RUNS.filter((run) => run.workflowId === workflow.workflowId) }),
      );
    }

    const workflowMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/workflows\/([^/]+)$/);
    const workflowId = workflowMatch?.[1];
    if (workflowId) {
      if (workflowId !== workflow.workflowId)
        return Promise.resolve(json({ error: 'not-found' }, 404));
      if (normalizedMethod === 'PATCH') {
        if (options?.failPatch) return Promise.resolve(json({ error: 'patch-failed' }, 500));
        const bodyText = typeof init?.body === 'string' ? init.body : '';
        const patch = (bodyText ? JSON.parse(bodyText) : {}) as UpdateWorkflowRequest;
        lastPatchBody = patch;
        workflow = {
          ...workflow,
          ...patch,
          actions: patch.actions ?? workflow.actions,
          version: workflow.version + 1,
        };
      }
      return Promise.resolve(json(workflow));
    }

    return Promise.resolve(
      json({ error: 'unhandled-endpoint', pathname, method: normalizedMethod }, 404),
    );
  });

  return {
    fetchMock,
    getLastPatchBody: () => lastPatchBody,
  };
}

async function renderEditRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/workflows/wf-invoice-remediation/edit'] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
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
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('workflow builder edit route', () => {
  it('loads workflow actions into builder and saves edits', async () => {
    const api = createFetchMock();
    vi.stubGlobal('fetch', api.fetchMock);

    await renderEditRoute();

    expect(
      await screen.findByRole('heading', { name: 'Edit Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Renamed Workflow' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Workflow' }));

    expect(
      await screen.findByRole('heading', { name: 'Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
    expect(await screen.findByText('Renamed Workflow')).toBeTruthy();

    const body = api.getLastPatchBody();
    expect(body?.name).toBe('Renamed Workflow');
    expect(body?.actions && body.actions.length > 0).toBe(true);
    expect(body?.actions?.[0]?.operation).toBe('agent:task');
  });

  it('shows an error and stays on edit view when save fails', async () => {
    const api = createFetchMock({ failPatch: true });
    vi.stubGlobal('fetch', api.fetchMock);

    await renderEditRoute();

    expect(
      await screen.findByRole('heading', { name: 'Edit Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Broken Save Attempt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Workflow' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to update workflow');
    expect(
      screen.getByRole('heading', { name: 'Edit Workflow: wf-invoice-remediation' }),
    ).toBeTruthy();
  });
});
