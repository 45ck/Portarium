// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

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
    if (/^\/v1\/workspaces\/[^/]+\/cockpit\/extension-context$/.test(url.pathname)) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            workspaceId: 'ws-demo',
            principalId: 'user-1',
            persona: 'Operator',
            availablePersonas: ['Operator'],
            availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
            availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
            activePackIds: ['example.reference'],
            quarantinedExtensionIds: [],
            issuedAtIso: '2026-04-30T02:00:00.000Z',
            expiresAtIso: '2999-04-30T02:05:00.000Z',
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ error: 'not-found' }), { status: 404 }));
  });
});

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
  useUIStore.setState({ activePersona: 'Operator', activeWorkspaceId: 'ws-demo' });
  useAuthStore.setState({
    status: 'authenticated',
    token: 'token-1',
    claims: {
      sub: 'user-1',
      workspaceId: 'ws-demo',
      roles: ['operator'],
      personas: ['Operator'],
      capabilities: ['extension:read', 'extension:review', 'evidence:read'],
      apiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
    },
    error: null,
  });
  queryClient.setQueryData(['cockpit-extension-context', 'ws-demo', 'user-1'], {
    schemaVersion: 1,
    workspaceId: 'ws-demo',
    principalId: 'user-1',
    persona: 'Operator',
    availablePersonas: ['Operator'],
    availableCapabilities: ['extension:read', 'extension:review', 'evidence:read'],
    availableApiScopes: ['extensions.read', 'approvals.read', 'evidence.read'],
    activePackIds: ['example.reference'],
    quarantinedExtensionIds: [],
    issuedAtIso: '2026-04-30T02:00:00.000Z',
    expiresAtIso: '2999-04-30T02:05:00.000Z',
  });
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('external extensions route', () => {
  it('renders enabled registry metadata and surfaces compiled extension routes in shell navigation', async () => {
    await renderRoute('/explore/extensions');

    expect(await screen.findByRole('heading', { name: 'External Extensions' })).toBeTruthy();
    expect(screen.getByText('Reference Extension')).toBeTruthy();
    expect(screen.getByText('Host Rules')).toBeTruthy();
    expect(screen.getByText('example.reference')).toBeTruthy();
    expect(screen.getByText('enabled')).toBeTruthy();
    expect(screen.getByText('/external/example-reference/overview')).toBeTruthy();
    expect(screen.getByText('/external/example-reference/reviews/$proposalId')).toBeTruthy();
    expect(screen.getByText('Open reference extension')).toBeTruthy();
    expect(screen.getByText('G X')).toBeTruthy();
    expect(screen.getByText('extension:read')).toBeTruthy();
    expect(screen.getByText('extension:review')).toBeTruthy();
    expect(screen.getByText('evidence:read')).toBeTruthy();

    const primaryNavigation = screen.getByLabelText('Primary navigation');
    expect(
      within(primaryNavigation).getByRole('link', { name: 'Reference Overview' }),
    ).toBeTruthy();
  });
});
