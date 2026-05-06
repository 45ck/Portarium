// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';

const { mockDataSourceStatus } = vi.hoisted(() => ({
  mockDataSourceStatus: vi.fn(),
}));

vi.mock('@/hooks/use-cockpit-data-source-status', () => ({
  useCockpitDataSourceStatus: mockDataSourceStatus,
}));

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

function extensionContext(workspaceId: string) {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  return {
    schemaVersion: 1,
    workspaceId,
    principalId: 'test-user',
    persona: 'Operator',
    availablePersonas: ['Operator'],
    availableCapabilities: [],
    availableApiScopes: [],
    availablePrivacyClasses: [],
    activePackIds: [],
    quarantinedExtensionIds: [],
    issuedAtIso: issuedAt,
    expiresAtIso: expiresAt,
  };
}

function baseStatus(overrides: Record<string, unknown> = {}) {
  return {
    state: 'demo',
    label: 'Demo',
    detail: 'ws-demo fixture data',
    workspaceId: 'ws-demo',
    modeLabel: 'Demo',
    canUseLiveActions: false,
    pendingOutboxCount: 0,
    refresh: vi.fn(),
    ...overrides,
  };
}

function createFetchMock(options: { failRobots?: boolean } = {}) {
  const calls: string[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url.pathname}`);

    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(
        json({
          items: [
            { workspaceId: 'ws-demo', name: 'Demo Workspace' },
            { workspaceId: 'ws-local-dev', name: 'Local Dev' },
          ],
        }),
      );
    }

    if (url.pathname.endsWith('/cockpit/extension-context')) {
      const workspaceId = url.pathname.split('/')[3] ?? 'ws-demo';
      return Promise.resolve(json(extensionContext(workspaceId)));
    }

    if (/\/approvals$/.test(url.pathname)) return Promise.resolve(json({ items: [] }));

    if (/\/robotics\/robots$/.test(url.pathname)) {
      if (options.failRobots) return Promise.resolve(json({ error: 'not-found' }, 404));
      return Promise.resolve(
        json({
          items: [
            {
              robotId: 'amr-001',
              name: 'AMR One',
              robotClass: 'AMR',
              status: 'Online',
              batteryPct: 82,
              lastHeartbeatSec: 12,
              missionId: 'mission-001',
              gatewayUrl: 'https://gateway.local',
              spiffeSvid: 'spiffe://portarium/robot/amr-001',
              capabilities: ['navigate_to'],
            },
          ],
        }),
      );
    }

    if (/\/robotics\/safety\/constraints$/.test(url.pathname)) {
      return Promise.resolve(
        json({
          items: [
            {
              constraintId: 'constraint-1',
              site: 'Floor A',
              constraint: 'Speed limit in shared aisle',
              enforcement: 'block',
              robotCount: 1,
            },
          ],
        }),
      );
    }

    if (/\/robotics\/safety\/thresholds$/.test(url.pathname)) {
      return Promise.resolve(
        json({
          items: [
            {
              actionClass: 'mission.cancel',
              tier: 'HumanApprove',
              notes: 'Requires operator review',
            },
          ],
        }),
      );
    }

    if (/\/robotics\/safety\/estop-log$/.test(url.pathname)) {
      return Promise.resolve(json({ items: [] }));
    }

    if (/\/robotics\/safety\/estop$/.test(url.pathname)) {
      return Promise.resolve(json({ active: false }));
    }

    return Promise.resolve(json({ items: [] }));
  });

  return { calls, fetchMock };
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
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('localStorage', createMemoryStorage());
  vi.stubGlobal('scrollTo', vi.fn());
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
  mockDataSourceStatus.mockReturnValue(baseStatus());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('robotics runtime gating', () => {
  it('shows an unsupported live-mode state without calling mock-only robotics endpoints', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');
    mockDataSourceStatus.mockReturnValue(
      baseStatus({
        state: 'live',
        label: 'Live',
        detail: 'Updated from API',
        modeLabel: 'Dev live',
        canUseLiveActions: true,
      }),
    );
    const { calls, fetchMock } = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await renderRoute('/robotics/robots');

    expect(
      await screen.findByRole('heading', { name: 'Robotics unavailable in live mode' }),
    ).toBeTruthy();
    expect(
      screen.getByText(/simulated robot, mission, gateway, and safety fixtures/i),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Robots' })).toBeNull();
    expect(calls.some((call) => call.includes('/robotics/'))).toBe(false);
  });

  it('keeps the robotics prototype available in explicit demo mode', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');
    const { calls, fetchMock } = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await renderRoute('/robotics/robots');

    expect(await screen.findByRole('heading', { name: 'Robots' })).toBeTruthy();
    expect(await screen.findByText('AMR One')).toBeTruthy();
    expect(screen.getByText(/Demo robotics telemetry is simulated/i)).toBeTruthy();
    expect(calls.some((call) => call.includes('/robotics/robots'))).toBe(true);
  });

  it('shows a degraded demo state when the robotics data source fails', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');
    const { fetchMock } = createFetchMock({ failRobots: true });
    vi.stubGlobal('fetch', fetchMock);

    await renderRoute('/robotics/robots');

    expect(await screen.findByRole('heading', { name: 'Robots' })).toBeTruthy();
    expect(await screen.findByText('Robots unavailable')).toBeTruthy();
  });

  it('keeps unsafe robotics actions disabled when telemetry is stale', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');
    mockDataSourceStatus.mockReturnValue(
      baseStatus({
        state: 'stale',
        label: 'Stale',
        detail: 'Last update 3m ago',
        canUseLiveActions: false,
      }),
    );
    const { fetchMock } = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await renderRoute('/robotics/safety');

    expect(await screen.findByRole('heading', { name: 'Safety & E-Stop' })).toBeTruthy();
    expect(screen.getByText(/Robotics controls disabled: stale data/i)).toBeTruthy();
    const estopButton = await screen.findByRole('button', {
      name: /robotics controls disabled: stale data/i,
    });
    expect((estopButton as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: /\+ Add Constraint/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
