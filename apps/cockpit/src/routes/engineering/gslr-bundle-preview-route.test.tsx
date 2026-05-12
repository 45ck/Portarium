// @vitest-environment jsdom

import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/query-client';
import { createCockpitRouter } from '@/router';

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

function createFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(rawUrl, 'http://localhost').pathname;

    if (pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/cockpit\/extension-context$/.test(pathname)) {
      return Promise.resolve(
        json({
          workspaceId: 'ws-demo',
          persona: 'operator',
          availablePersonas: ['operator'],
          availableCapabilities: [],
          availableApiScopes: [],
          availablePrivacyClasses: [],
          activePackIds: [],
          quarantinedExtensionIds: [],
          issuedAtIso: '2026-05-13T00:00:00Z',
          expiresAtIso: '2026-05-13T01:00:00Z',
        }),
      );
    }

    return Promise.resolve(json({ error: 'unhandled-endpoint', pathname }, 404));
  });
}

async function renderRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({
      initialEntries: ['/engineering/evidence-cards/bundle-preview'],
    }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('localStorage', createMemoryStorage());
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
});

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  vi.stubEnv('VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT', 'true');
  vi.stubGlobal('fetch', createFetch());
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('GSLR bundle preview route', () => {
  it('verifies a static bundle without calling live engineering endpoints', async () => {
    await renderRoute();

    expect(await screen.findByRole('heading', { name: 'GSLR Bundle Preview' })).toBeTruthy();
    expect(screen.getByText('No persistence')).toBeTruthy();
    expect(screen.getByText('No action controls')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Verify bundle/i }));

    expect(screen.getByText('Bundle verified')).toBeTruthy();
    expect(screen.getByText('gslr8-route-record-compiler')).toBeTruthy();

    const fetchMock = vi.mocked(fetch);
    const requestedPaths = fetchMock.mock.calls.map(([input]) => {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return new URL(rawUrl, 'http://localhost').pathname;
    });

    expect(requestedPaths).not.toContain('/v1/workspaces/ws-demo/runs');
    expect(requestedPaths).not.toContain('/v1/workspaces/ws-demo/evidence');
    expect(requestedPaths).not.toContain('/v1/workspaces/ws-demo/work-items');
    expect(requestedPaths).not.toContain('/v1/workspaces/ws-demo/human-tasks');
    expect(requestedPaths).not.toContain('/v1/workspaces/ws-demo/workforce/queues');
  });
});
