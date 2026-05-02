// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';

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

async function renderCapabilityPostureRoute(initialEntry = '/config/capability-posture') {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return router;
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
  vi.stubGlobal('scrollTo', vi.fn());
  if (typeof ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  }
});

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] }));
    }
    return Promise.resolve(json({ items: [] }));
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Capability Posture route', () => {
  it('renders default tiers, roles, evidence, inheritance, and exceptions', async () => {
    await renderCapabilityPostureRoute();

    expect(await screen.findByRole('heading', { name: 'Capability Posture' })).toBeTruthy();
    expect(screen.getByText(/Default posture matrix/i)).toBeTruthy();
    expect(screen.getAllByText(/External communication/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Human Approve/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Approver, Comms operator/i)).toBeTruthy();
    expect(screen.getByText(/Draft preview, Recipient or target list, Policy trace/i)).toBeTruthy();
    expect(screen.getAllByText(/Workspace default \/ Comms policy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/VIP recipient exception/i).length).toBeGreaterThan(0);
  });

  it('previews presets and updates the effective-posture explanation', async () => {
    const router = await renderCapabilityPostureRoute(
      '/config/capability-posture?capability=money-movement',
    );

    expect(
      await screen.findByText(/Money movement starts from Workspace default \/ Finance policy/i),
    ).toBeTruthy();
    expect(screen.getByText(/The Balanced preset resolves it to ManualOnly/i)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /Conservative/i }));

    expect(router.state.location.search).toMatchObject({ preset: 'conservative' });
    expect(
      await screen.findByText(/Conservative changes this row before exceptions/i),
    ).toBeTruthy();
    expect(screen.getByText(/Large transfers require manual dual control/i)).toBeTruthy();
  });
});
