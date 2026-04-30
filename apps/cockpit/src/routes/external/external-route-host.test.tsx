// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useUIStore } from '@/stores/ui-store';

const externalRouteHostTestState = vi.hoisted(() => ({
  omitHostedComponents: false,
}));

vi.mock('@/components/cockpit/extensions/external-route-adapter', async (importActual) => {
  const actual =
    await importActual<typeof import('@/components/cockpit/extensions/external-route-adapter')>();

  return {
    ...actual,
    resolveExternalRoute: (input: Parameters<typeof actual.resolveExternalRoute>[0]) =>
      actual.resolveExternalRoute({
        ...input,
        components: externalRouteHostTestState.omitHostedComponents ? {} : input.components,
      }),
  };
});

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
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('localStorage', createMemoryStorage());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(
        new Response(JSON.stringify({ items: [{ workspaceId: 'ws-demo', name: 'Demo' }] }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(url.pathname)) {
      return Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'not-found' }), { status: 404 }));
  });
});

beforeEach(() => {
  externalRouteHostTestState.omitHostedComponents = false;
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
  useUIStore.setState({ activePersona: 'Operator' });
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('external route host', () => {
  it('loads the neutral overview route through the compiled external host', async () => {
    await renderRoute('/external/example-ops/overview');

    expect(await screen.findByRole('heading', { name: 'Operations Overview' })).toBeTruthy();
    expect(await screen.findByText('Extension Boundary')).toBeTruthy();
    expect(screen.queryByText('Host Fallback')).toBeNull();
  });

  it('loads parameterized neutral routes declared by the extension manifest', async () => {
    await renderRoute('/external/example-ops/actions/proposal-123');

    expect(await screen.findByRole('heading', { name: 'Governed Action Review' })).toBeTruthy();
    expect(await screen.findByText('Review Contract')).toBeTruthy();
    expect(screen.queryByText('External Route Not Found')).toBeNull();
  });

  it('fails closed when no installed extension declares the external path', async () => {
    await renderRoute('/external/example-ops/unknown');

    expect(await screen.findByRole('heading', { name: 'External Route Not Found' })).toBeTruthy();
    expect(screen.getByText('No enabled extension route matches this external path.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View extension registry' })).toBeTruthy();
  });

  it('fails closed when the active persona is forbidden from the external route', async () => {
    useUIStore.setState({ activePersona: 'Guest' as never });

    await renderRoute('/external/example-ops/overview');

    expect(await screen.findByRole('heading', { name: 'Extension Route Restricted' })).toBeTruthy();
    expect(
      screen.getByText('This route is not available for the active Cockpit persona.'),
    ).toBeTruthy();
    expect(screen.getByText('Host Fallback')).toBeTruthy();
    expect(screen.getByText('restricted')).toBeTruthy();
    expect(screen.queryByText('Extension Boundary')).toBeNull();
  });

  it('falls back when an active external route has no host-owned renderer', async () => {
    externalRouteHostTestState.omitHostedComponents = true;

    await renderRoute('/external/example-ops/actions/proposal-123');

    expect(await screen.findByRole('heading', { name: 'Governed Action Review' })).toBeTruthy();
    expect(
      screen.getByText(
        'This extension route is active, but this Cockpit build does not include a host-owned renderer for it.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Host Fallback')).toBeTruthy();
    expect(screen.getByText('Operations Demo')).toBeTruthy();
    expect(screen.getByText('example-ops-action-review')).toBeTruthy();
    expect(screen.getByText('renderer missing')).toBeTruthy();
    expect(screen.getByText('proposalId=proposal-123')).toBeTruthy();
    expect(screen.queryByText('Review Contract')).toBeNull();
  });
});
