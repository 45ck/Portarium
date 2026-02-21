// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { DEFAULT_PACK_UI_RUNTIME, DEMO_PACK_UI_RUNTIME } from '@/mocks/fixtures/pack-ui-runtime';

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

function createFetch(runtime: typeof DEMO_PACK_UI_RUNTIME) {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(rawUrl, 'http://localhost').pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({ items: [{ workspaceId: 'ws-meridian', name: 'Meridian Workspace' }] }),
      );
    }

    if (/^\/v1\/workspaces\/[^/]+\/pack-ui-runtime$/.test(pathname)) {
      return Promise.resolve(json(runtime));
    }

    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: [] }));
    }

    return Promise.resolve(json({ error: 'unhandled-endpoint', pathname }, 404));
  });
}

async function renderRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/explore/pack-runtime'] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 844 });
  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
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

describe('pack runtime page', () => {
  it('renders schema-driven fields and applies safe theme tokens', async () => {
    vi.stubGlobal('fetch', createFetch(DEMO_PACK_UI_RUNTIME));
    await renderRoute();

    expect(await screen.findByRole('heading', { name: 'Pack Runtime' })).toBeTruthy();
    expect(await screen.findByRole('form', { name: 'Pack template form' })).toBeTruthy();
    expect(await screen.findByLabelText('Rollback plan reference')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('hsl(258 90% 56%)');
  });

  it('falls back to core template fields when pack template is unavailable', async () => {
    vi.stubGlobal('fetch', createFetch(DEFAULT_PACK_UI_RUNTIME));
    await renderRoute();

    expect(await screen.findByRole('heading', { name: 'Pack Runtime' })).toBeTruthy();
    expect(await screen.findByText('Core fallback')).toBeTruthy();
    expect(await screen.findByLabelText('Summary')).toBeTruthy();
  });
});
