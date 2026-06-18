// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { AGENTS, MACHINES, RUNS } from '@/mocks/fixtures/demo';

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

    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({
          items: [
            { workspaceId: 'ws-demo', name: 'Demo Workspace' },
            { workspaceId: 'ws-platform-showcase', name: 'Platform Showcase' },
          ],
        }),
      );
    }

    if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(url.pathname)) {
      return Promise.resolve(json({ items: AGENTS }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/machines$/.test(url.pathname)) {
      return Promise.resolve(json({ items: MACHINES }));
    }

    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(url.pathname)) {
      return Promise.resolve(json({ items: RUNS }));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderAgentRoute(initialEntry: string) {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
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

describe('Agent detail operator UI', () => {
  it('lists the OpenClaw gateway instance with the live agents', async () => {
    await renderAgentRoute('/config/agents');

    expect(await screen.findByRole('heading', { name: 'Live Agents' })).toBeTruthy();
    expect(await screen.findByText('OpenClaw Gateway Demo')).toBeTruthy();
    expect(await screen.findByText('agent-openclaw-gateway-demo')).toBeTruthy();
  });

  it('renders the hosted OpenClaw operator iframe as the focused gateway surface', async () => {
    await renderAgentRoute('/config/agents/agent-openclaw-gateway-demo');

    expect(await screen.findByRole('heading', { name: 'OpenClaw Gateway Demo' })).toBeTruthy();
    expect(screen.getByText('OpenClaw Operator UI')).toBeTruthy();
    expect(screen.getByText('Direct tunnel')).toBeTruthy();
    expect(screen.getByText('Read-only')).toBeTruthy();
    expect(screen.queryByText('Surface')).toBeNull();
    expect(screen.queryByText('Boundary')).toBeNull();
    expect(screen.queryByText('Denied Operations')).toBeNull();
    expect(screen.queryByText('Agent ID')).toBeNull();
    expect(screen.queryByText('No executor access from Cockpit')).toBeNull();

    const openLink = screen.getByRole('link', { name: 'Open' });
    expect(openLink.getAttribute('href')).toBe('http://localhost:19037/chat?session=main');
    expect(openLink.getAttribute('target')).toBe('_blank');
    const reloadButton = screen.getByRole('button', { name: 'Reload OpenClaw Operator UI' });
    expect(reloadButton).toBeTruthy();
    const iframe = screen.getByTestId('operator-ui-frame');
    expect(iframe.getAttribute('title')).toBe('OpenClaw Gateway Demo operator UI');
    expect(iframe.getAttribute('src')).toBe('http://localhost:19037/chat?session=main');
    expect(iframe.getAttribute('sandbox')).toBeNull();
    expect(iframe.getAttribute('allow')).toContain('clipboard-write');
    expect(screen.queryByText('Operator surface unavailable for embedded display.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(await screen.findByText('Surface')).toBeTruthy();
    expect(screen.getByText('Mode')).toBeTruthy();
    expect(screen.getByText('embedded')).toBeTruthy();
    expect(screen.getByText('Boundary')).toBeTruthy();
    expect(screen.getByText('Denied Operations')).toBeTruthy();
    expect(screen.getByText('No executor access from Cockpit')).toBeTruthy();
    expect(screen.getByText('A4/A5 execution')).toBeTruthy();
    expect(screen.getByText('Agent ID')).toBeTruthy();
    expect(screen.getByText('agent-openclaw-gateway-demo')).toBeTruthy();
    expect(screen.getByText('Agent Metadata')).toBeTruthy();
    expect(screen.getByText('Connected Machine')).toBeTruthy();
    expect(screen.getByText('Capabilities')).toBeTruthy();
    expect(screen.getByText('Used by Workflows')).toBeTruthy();
    expect(screen.getByText('Recent Runs')).toBeTruthy();

    fireEvent.click(reloadButton);
    const reloadedIframe = screen.getByTestId('operator-ui-frame');
    expect(reloadedIframe).not.toBe(iframe);
    expect(reloadedIframe.getAttribute('src')).toBe('http://localhost:19037/chat?session=main');
  });

  it('does not render the operator surface for ordinary agents', async () => {
    await renderAgentRoute('/config/agents/agent-001');

    expect(await screen.findByRole('heading', { name: 'Invoice Analyzer' })).toBeTruthy();
    expect(screen.queryByText('OpenClaw Operator UI')).toBeNull();
    expect(screen.queryByTitle(/operator UI/i)).toBeNull();
  });
});
