// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { useUIStore } from '@/stores/ui-store';
import {
  APPROVALS,
  APPROVAL_COVERAGE_ROSTER,
  WORKFORCE_MEMBERS,
  WORKFORCE_QUEUES,
} from '@/mocks/fixtures/demo';
import type {
  ApprovalCoverageRosterSummary,
  CreateApprovalCoverageWindowRequest,
} from '@portarium/cockpit-types';

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

function cloneRoster(): ApprovalCoverageRosterSummary {
  return structuredClone(APPROVAL_COVERAGE_ROSTER);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetchMock() {
  let roster = cloneRoster();

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const { pathname } = new URL(rawUrl, 'http://localhost');

    if (pathname === '/v1/workspaces') {
      return json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] });
    }
    if (/^\/v1\/workspaces\/[^/]+\/approvals$/.test(pathname)) {
      return json({ items: APPROVALS });
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce$/.test(pathname)) {
      return json({ items: WORKFORCE_MEMBERS });
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce\/queues$/.test(pathname)) {
      return json({ items: WORKFORCE_QUEUES });
    }
    if (/^\/v1\/workspaces\/[^/]+\/workforce\/approval-coverage$/.test(pathname)) {
      return json(roster);
    }
    if (
      /^\/v1\/workspaces\/[^/]+\/workforce\/approval-coverage\/windows$/.test(pathname) &&
      init?.method === 'POST'
    ) {
      const body = JSON.parse(String(init.body)) as CreateApprovalCoverageWindowRequest;
      const id = 'cov-test-created';
      roster = {
        ...roster,
        coverageWindows: [
          {
            schemaVersion: 1,
            coverageWindowId: id,
            workspaceId: 'ws-demo',
            name: body.name,
            approvalClass: body.approvalClass,
            startsAtIso: body.startsAtIso,
            endsAtIso: body.endsAtIso,
            timezone: body.timezone,
            queueId: body.queueId,
            primaryMemberIds: body.primaryMemberIds,
            fallbackQueueId: body.fallbackQueueId,
            state: 'active',
            updatedByUserId: 'user-ops-alex',
            updatedAtIso: '2026-02-20T09:00:00Z',
          },
          ...roster.coverageWindows,
        ],
        auditTrail: [
          {
            schemaVersion: 1,
            auditId: 'aud-test-created',
            workspaceId: 'ws-demo',
            changedAtIso: '2026-02-20T09:00:00Z',
            changedByUserId: 'user-ops-alex',
            governanceFunction: 'operator',
            authoritySource: 'workspace-rbac',
            action: 'coverage-window-created',
            targetType: 'coverage-window',
            targetId: id,
            summary: `Created coverage window '${body.name}': ${body.rationale}`,
            evidenceId: 'evd-test-created',
          },
          ...roster.auditTrail,
        ],
      };
      return json(roster, 201);
    }
    if (/^\/v1\/workspaces\/[^/]+\/pack-ui-runtime$/.test(pathname)) {
      return json({});
    }
    return json({ error: 'unhandled', pathname }, 404);
  });
}

async function renderCoverageRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/workforce/coverage'] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  vi.stubGlobal('localStorage', createMemoryStorage());
  vi.stubGlobal('scrollTo', vi.fn());
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
  vi.stubEnv('VITE_DEMO_MODE', 'true');
  vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');
  queryClient.clear();
  localStorage.clear();
  document.documentElement.className = '';
  useUIStore.getState().setActiveWorkspaceId('ws-demo');
  installFetchMock();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('workforce coverage route', () => {
  it('does not expose fixture-backed coverage in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');
    useUIStore.getState().setActivePersona('Operator');

    await renderCoverageRoute();

    expect(await screen.findByRole('heading', { name: 'Coverage' })).toBeTruthy();
    expect(screen.getByText(/fixture-backed roster is available only/i)).toBeTruthy();
    expect(screen.queryByText('Coverage Windows')).toBeNull();
  });

  it('explains assigned, delegated, waiting, and escalated pending approval routing', async () => {
    useUIStore.getState().setActivePersona('Operator');
    await renderCoverageRoute();

    expect(await screen.findByRole('heading', { name: 'Coverage' })).toBeTruthy();
    expect(screen.getByText('assigned')).toBeTruthy();
    expect(screen.getByText('delegated')).toBeTruthy();
    expect(screen.getByText('waiting-for-coverage')).toBeTruthy();
    expect(screen.getByText('escalated')).toBeTruthy();
    expect(screen.getByText(/No active RoboticsActuation safety window/)).toBeTruthy();
  });

  it('lets an Operator add attributable coverage and appends audit evidence', async () => {
    const user = userEvent.setup();
    useUIStore.getState().setActivePersona('Operator');
    await renderCoverageRoute();

    const addCoverage = await screen.findByRole('button', { name: /Add coverage window/ });
    expect(addCoverage.hasAttribute('disabled')).toBe(false);

    await user.click(addCoverage);

    await waitFor(() => {
      expect(
        screen.getByText(/Created coverage window 'Operator-team approval coverage'/),
      ).toBeTruthy();
    });
    expect(screen.getByText('evd-test-created')).toBeTruthy();
    expect(screen.getAllByText('user-ops-alex').length).toBeGreaterThan(0);
  });

  it('keeps Approver read-only for coverage changes', async () => {
    useUIStore.getState().setActivePersona('Approver');
    await renderCoverageRoute();

    expect(await screen.findByText(/Approver can inspect coverage and audit history/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Add coverage window/ }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByRole('button', { name: /Add delegate/ }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: /Update route/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
