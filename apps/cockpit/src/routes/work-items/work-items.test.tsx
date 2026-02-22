// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { WORK_ITEMS, RUNS, APPROVALS, EVIDENCE } from '@/mocks/fixtures/demo';

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
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-test', name: 'Test Workspace' }] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
      return Promise.resolve(json({ items: WORK_ITEMS }));
    }

    const workItemMatch = pathname.match(/^\/v1\/workspaces\/[^/]+\/work-items\/([^/]+)$/);
    if (workItemMatch) {
      const workItem = WORK_ITEMS.find((w) => w.workItemId === workItemMatch[1]);
      return Promise.resolve(workItem ? json(workItem) : json({ error: 'not-found' }, 404));
    }

    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname)) {
      return Promise.resolve(json({ items: RUNS }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: APPROVALS }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
      return Promise.resolve(json({ items: EVIDENCE }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/workforce\/members$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/users$/.test(pathname) && init?.method !== 'POST') {
      return Promise.resolve(json({ items: [] }));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderWorkItemsRoute(path = '/work-items') {
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
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Work Items hub', () => {
  it('renders the Work Items heading', async () => {
    await renderWorkItemsRoute();
    expect(await screen.findByRole('heading', { name: 'Work Items' })).toBeTruthy();
  });

  it('displays work items from the API with title and status', async () => {
    await renderWorkItemsRoute();

    const first = WORK_ITEMS[0]!;
    expect(await screen.findByText(first.title)).toBeTruthy();
    expect(await screen.findByText(first.status)).toBeTruthy();
  });

  it('shows the status filter bar', async () => {
    await renderWorkItemsRoute();

    await screen.findByRole('heading', { name: 'Work Items' });
    const statusFilters = screen.queryAllByText('Status');
    expect(statusFilters.length).toBeGreaterThan(0);
  });

  it('shows the links count for items that have linked entities', async () => {
    await renderWorkItemsRoute();

    await screen.findByText(WORK_ITEMS[0]!.title);
    // wi-1001 has run + approval links = count > 0
    const wi1001 = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    const expectedCount =
      (wi1001.links?.runIds?.length ?? 0) +
      (wi1001.links?.approvalIds?.length ?? 0) +
      (wi1001.links?.evidenceIds?.length ?? 0) +
      (wi1001.links?.externalRefs?.length ?? 0);
    expect(expectedCount).toBeGreaterThan(0);
    expect(await screen.findByText(String(expectedCount))).toBeTruthy();
  });

  it('navigates to work item detail when a row is clicked', async () => {
    await renderWorkItemsRoute();

    const firstTitle = await screen.findByText(WORK_ITEMS[0]!.title);
    await userEvent.click(firstTitle);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: WORK_ITEMS[0]!.title })).not.toBeNull();
    });
  });
});

describe('Work Item detail (hub view)', () => {
  it('renders the work item title as heading', async () => {
    const wi = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByRole('heading', { name: wi.title })).toBeTruthy();
  });

  it('shows linked runs section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Linked Runs')).toBeTruthy();
  });

  it('shows linked approvals section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Linked Approvals')).toBeTruthy();
  });

  it('shows evidence section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Evidence')).toBeTruthy();
  });

  it('shows Details card with status badge', async () => {
    const wi = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Details')).toBeTruthy();
    const statusBadges = await screen.findAllByText(wi.status);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('shows not-found message for a missing work item ID', async () => {
    await renderWorkItemsRoute('/work-items/wi-does-not-exist');

    expect(await screen.findByText(/does not exist or could not be loaded/i)).toBeTruthy();
  });
});
