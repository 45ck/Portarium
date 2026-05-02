// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import {
  AGENTS,
  APPROVALS,
  EVIDENCE,
  MACHINES,
  RUNS,
  WORKFORCE_QUEUES,
  WORK_ITEMS,
} from '@/mocks/fixtures/demo';
import { buildMockHumanTasks } from '@/mocks/fixtures/human-tasks';
import { WORKFORCE_MEMBERS } from '@/mocks/fixtures/demo';

const HUMAN_TASKS = buildMockHumanTasks(RUNS, WORK_ITEMS, WORKFORCE_MEMBERS);

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
    if (/^\/v1\/workspaces\/[^/]+\/runs$/.test(pathname))
      return Promise.resolve(json({ items: RUNS }));
    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return Promise.resolve(json({ items: APPROVALS }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/evidence$/.test(pathname)) {
      return Promise.resolve(json({ items: EVIDENCE }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/work-items$/.test(pathname)) {
      return Promise.resolve(json({ items: WORK_ITEMS }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/agents$/.test(pathname)) {
      return Promise.resolve(json({ items: AGENTS }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/machines$/.test(pathname)) {
      return Promise.resolve(json({ items: MACHINES }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce\/queues$/.test(pathname)) {
      return Promise.resolve(json({ items: WORKFORCE_QUEUES }));
    }
    if (/^\/v1\/workspaces\/[^/]+\/human-tasks$/.test(pathname)) {
      return Promise.resolve(json({ items: HUMAN_TASKS }));
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
          issuedAtIso: '2026-04-30T00:00:00Z',
          expiresAtIso: '2026-04-30T01:00:00Z',
        }),
      );
    }

    return Promise.resolve(json({ error: 'unhandled-endpoint', pathname }, 404));
  });
}

async function renderRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/engineering/mission-control'] }),
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
  vi.stubGlobal('fetch', createFetch());
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Mission Control route', () => {
  it('renders the Portarium-native Mission Control shell with live governance data', async () => {
    await renderRoute();

    expect(await screen.findByRole('heading', { name: 'Mission Control' })).toBeTruthy();
    expect(await screen.findByText('Operator Shell')).toBeTruthy();
    expect(await screen.findByText('Approval Gate Queue')).toBeTruthy();
    expect(await screen.findByText('Run Status Board')).toBeTruthy();
    expect(await screen.findByText('Evidence Stream')).toBeTruthy();
    expect((await screen.findAllByText('Governance Signal')).length).toBeGreaterThan(1);
    expect(await screen.findByText('Human Decisions')).toBeTruthy();
    expect((await screen.findAllByText('run-2001')).length).toBeGreaterThan(0);
    expect(await screen.findByText('FINANCE-APPROVAL-001')).toBeTruthy();
    expect(await screen.findByText('evd-4004')).toBeTruthy();
  });
});
