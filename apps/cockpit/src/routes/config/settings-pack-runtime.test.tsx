// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import {
  CORE_CHANGE_REQUEST_TEMPLATE,
  DEFAULT_PACK_UI_RUNTIME,
  DEMO_PACK_UI_RUNTIME,
} from '@/mocks/fixtures/pack-ui-runtime';

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

function createFetchMock(runtimeResponse: unknown) {
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

    if (/^\/v1\/workspaces\/[^/]+\/pack-ui-runtime$/.test(pathname)) {
      return Promise.resolve(json(runtimeResponse));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderSettingsRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/config/settings'] }),
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
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('settings pack runtime integration', () => {
  it('renders pack template and applies safe theme tokens', async () => {
    vi.stubGlobal('fetch', createFetchMock(DEMO_PACK_UI_RUNTIME));

    await renderSettingsRoute();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(await screen.findByLabelText('Rollback plan reference')).toBeTruthy();
    const templateSource = screen.getByText(/Template source:/);
    expect(templateSource.textContent).toContain('pack');
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('hsl(258 90% 56%)');
  });

  it('falls back to core template when pack template is missing', async () => {
    const fallbackRuntime = {
      ...DEFAULT_PACK_UI_RUNTIME,
      coreTemplates: [CORE_CHANGE_REQUEST_TEMPLATE],
    };
    vi.stubGlobal('fetch', createFetchMock(fallbackRuntime));

    await renderSettingsRoute();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
    expect(await screen.findByLabelText('Summary')).toBeTruthy();
    const templateSource = screen.getByText(/Template source:/);
    expect(templateSource.textContent).toContain('core');
  });
});
