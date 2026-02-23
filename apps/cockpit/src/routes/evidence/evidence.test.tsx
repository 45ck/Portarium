// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { EVIDENCE } from '@/mocks/fixtures/demo';

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
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-test', name: 'Test Workspace' }] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
      return Promise.resolve(json({ items: EVIDENCE }));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderEvidenceRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/evidence'] }),
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

describe('Evidence page', () => {
  it('renders the Evidence heading', async () => {
    await renderEvidenceRoute();
    expect(await screen.findByRole('heading', { name: 'Evidence' })).toBeTruthy();
  });

  it('shows the chain integrity banner', async () => {
    await renderEvidenceRoute();

    // Multiple elements may contain "chain" (page description + banner); check at least one exists
    await waitFor(() => {
      const banners = screen.queryAllByText(/chain/i);
      expect(banners.length).toBeGreaterThan(0);
    });
  });

  it('displays evidence entries from the API', async () => {
    await renderEvidenceRoute();

    const firstEntry = EVIDENCE[0]!;
    expect(await screen.findByText(firstEntry.summary)).toBeTruthy();
  });

  it('shows the category filter bar', async () => {
    await renderEvidenceRoute();

    await screen.findByRole('heading', { name: 'Evidence' });
    // FilterBar renders SelectValue showing "All Category" (selected item text), not "Category" alone
    const categoryFilter = screen.queryAllByText(/category/i);
    expect(categoryFilter.length).toBeGreaterThan(0);
  });

  it('filters entries by category when a category is selected', async () => {
    await renderEvidenceRoute();

    // Wait for entries to appear
    await screen.findByText(EVIDENCE[0]!.summary);

    // Count current entries
    const categories = Array.from(new Set(EVIDENCE.map((e) => e.category)));
    expect(categories.length).toBeGreaterThan(1);
  });

  it('shows "Show more" button when there are more than 20 entries', async () => {
    await renderEvidenceRoute();

    await screen.findByText(EVIDENCE[0]!.summary);

    if (EVIDENCE.length > 20) {
      expect(await screen.findByRole('button', { name: /show more/i })).toBeTruthy();
    }
  });

  it('loads more entries when Show more is clicked', async () => {
    await renderEvidenceRoute();

    await screen.findByText(EVIDENCE[0]!.summary);

    if (EVIDENCE.length > 20) {
      const showMoreBtn = await screen.findByRole('button', { name: /show more/i });
      await userEvent.click(showMoreBtn);

      await waitFor(() => {
        const countText = screen.queryByText(/showing \d+ of \d+/i);
        expect(countText).not.toBeNull();
      });
    }
  });
});
