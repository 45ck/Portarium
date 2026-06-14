// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { AGENTS, MACHINES } from '@/mocks/fixtures/demo';
import type { AgentV1, MachineV1 } from '@portarium/cockpit-types';

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

function createFetchMock({
  agents = AGENTS,
  machines = MACHINES,
}: {
  agents?: readonly AgentV1[];
  machines?: readonly MachineV1[];
} = {}) {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');

    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(url.pathname)) {
      return Promise.resolve(json({ items: agents }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/machines$/.test(url.pathname)) {
      return Promise.resolve(json({ items: machines }));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderAgentsRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/config/agents'] }),
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
  vi.stubEnv('VITE_DEMO_MODE', 'true');
  vi.stubEnv('VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT', 'true');
  queryClient.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', createFetchMock());
  useUIStore.setState({
    sidebarCollapsed: false,
    activePersona: 'Operator',
    activeWorkspaceId: 'ws-demo',
  });
  useAuthStore.setState({
    status: 'authenticated',
    token: 'token-1',
    claims: {
      sub: 'user-1',
      workspaceId: 'ws-demo',
      roles: ['operator'],
      personas: ['Operator'],
      capabilities: ['extension:read', 'extension:inspect'],
      apiScopes: ['extensions.read', 'extensions.inspect'],
    },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Agents page live roster', () => {
  it('shows only machine-backed agents with an available operator UI', async () => {
    await renderAgentsRoute();

    expect(await screen.findByRole('heading', { name: 'Live Agents' })).toBeTruthy();
    expect(await screen.findByText('OpenClaw Gateway Demo')).toBeTruthy();
    expect(screen.getByText('openclaw-gateway-demo')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();

    expect(screen.queryByText('Invoice Analyzer')).toBeNull();
    expect(screen.queryByText('HR Sync Agent')).toBeNull();
    expect(screen.queryByText('CRM Dedup Agent')).toBeNull();
    expect(screen.queryByText('Machine Robot Controller')).toBeNull();
  });

  it('shows an explicit empty state when no live operator agents exist', async () => {
    const agentsWithoutOperatorUi = AGENTS.filter(
      (agent) => agent.agentId !== 'agent-openclaw-gateway-demo',
    );
    vi.stubGlobal('fetch', createFetchMock({ agents: agentsWithoutOperatorUi }));

    await renderAgentsRoute();

    expect(await screen.findByText('No live agents')).toBeTruthy();
    expect(screen.queryByText('Machine Robot Controller')).toBeNull();
  });
});
