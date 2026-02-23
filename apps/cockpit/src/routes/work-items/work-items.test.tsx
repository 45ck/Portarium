// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { WORK_ITEMS, RUNS, APPROVALS, EVIDENCE } from '@/mocks/fixtures/demo';
import type { WorkItemSummary } from '@portarium/cockpit-types';

const OFFLINE_META = {
  isOffline: false,
  isStaleData: false,
  dataSource: 'network' as const,
  lastSyncAtIso: undefined,
};

// Mutable state — reset in beforeEach
let _mockWorkItems: WorkItemSummary[] = [...WORK_ITEMS];
let _mockWorkItemId: string | null = null; // null = return undefined (loading/not-found)
let _mockWorkItemIsError = false;
const _mockRefetch = vi.fn();

vi.mock('@/hooks/queries/use-work-items', () => ({
  useWorkItems: vi.fn(() => ({
    data: { items: _mockWorkItems },
    isLoading: false,
    isError: false,
    refetch: _mockRefetch,
    offlineMeta: OFFLINE_META,
  })),
  useWorkItem: vi.fn((_wsId: string, wiId: string) => {
    if (_mockWorkItemIsError) {
      return { data: undefined, isLoading: false, isError: true, offlineMeta: OFFLINE_META };
    }
    const item = _mockWorkItems.find((w) => w.workItemId === wiId);
    return {
      data: item,
      isLoading: false,
      isError: !item,
      offlineMeta: OFFLINE_META,
    };
  }),
  useUpdateWorkItem: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock('@/hooks/queries/use-users', () => ({
  useUsers: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useInviteUser: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  usePatchUser: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('@/hooks/queries/use-runs', () => ({
  useRuns: vi.fn(() => ({
    data: { items: RUNS },
    isLoading: false,
    offlineMeta: OFFLINE_META,
  })),
  useRun: vi.fn(() => ({ data: undefined, isLoading: false, offlineMeta: OFFLINE_META })),
}));

vi.mock('@/hooks/queries/use-approvals', () => ({
  useApprovals: vi.fn(() => ({
    data: { items: APPROVALS },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    offlineMeta: OFFLINE_META,
  })),
  useApproval: vi.fn(() => ({ data: undefined, isLoading: false, offlineMeta: OFFLINE_META })),
  useApprovalDecision: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/hooks/queries/use-evidence', () => ({
  useEvidence: vi.fn(() => ({
    data: { items: EVIDENCE },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('@/hooks/queries/use-workforce', () => ({
  useWorkforceMembers: vi.fn(() => ({ data: { items: [] }, isLoading: false })),
  useWorkforceQueues: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/hooks/queries/use-workflows', () => ({
  useWorkflows: vi.fn(() => ({ data: undefined, isLoading: false, offlineMeta: OFFLINE_META })),
  useWorkflow: vi.fn(() => ({ data: undefined, isLoading: false, offlineMeta: OFFLINE_META })),
}));

vi.mock('@/hooks/queries/use-plan', () => ({
  usePlan: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/hooks/queries/use-approval-decision-outbox', () => ({
  useApprovalDecisionOutbox: vi.fn(() => ({
    submitDecision: vi.fn().mockResolvedValue({ queued: false }),
    pendingCount: 0,
    isFlushing: false,
    flushNow: vi.fn(),
  })),
}));

async function renderWorkItemsRoute(path = '/work-items') {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
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
  _mockWorkItems = [...WORK_ITEMS];
  _mockWorkItemId = null;
  _mockWorkItemIsError = false;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Work Items hub', () => {
  it('renders the Work Items heading', async () => {
    await renderWorkItemsRoute();
    expect(await screen.findByRole('heading', { name: 'Work Items' })).toBeTruthy();
  });

  it('displays work items from the API with title and status', async () => {
    await renderWorkItemsRoute();

    const first = WORK_ITEMS[0]!;
    expect(await screen.findByText(first.title)).toBeTruthy();
    // Status rendered as badge — find at least one badge with status text
    const badges = await screen.findAllByText(first.status);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows the status filter bar', async () => {
    await renderWorkItemsRoute();

    await screen.findByRole('heading', { name: 'Work Items' });
    // 'Status' appears in the DataTable column header
    const statusElements = screen.queryAllByText('Status');
    expect(statusElements.length).toBeGreaterThan(0);
  });

  it('shows the links count for items that have linked entities', async () => {
    await renderWorkItemsRoute();

    await screen.findByText(WORK_ITEMS[0]!.title);
    const wi1001 = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    const expectedCount =
      (wi1001.links?.runIds?.length ?? 0) +
      (wi1001.links?.approvalIds?.length ?? 0) +
      (wi1001.links?.evidenceIds?.length ?? 0) +
      (wi1001.links?.externalRefs?.length ?? 0);
    expect(expectedCount).toBeGreaterThan(0);
    expect(await screen.findByText(String(expectedCount))).toBeTruthy();
  });

  it('navigates to work item detail when a row is clicked', async () => {
    await renderWorkItemsRoute();

    const firstTitle = await screen.findByText(WORK_ITEMS[0]!.title);
    await userEvent.click(firstTitle);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: WORK_ITEMS[0]!.title })).not.toBeNull();
    });
  });
});

describe('Work Item detail (hub view)', () => {
  it('renders the work item title as heading', async () => {
    const wi = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByRole('heading', { name: wi.title })).toBeTruthy();
  });

  it('shows linked runs section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Linked Runs')).toBeTruthy();
  });

  it('shows linked approvals section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Linked Approvals')).toBeTruthy();
  });

  it('shows evidence section', async () => {
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Evidence')).toBeTruthy();
  });

  it('shows Details card with status badge', async () => {
    const wi = WORK_ITEMS.find((w) => w.workItemId === 'wi-1001')!;
    await renderWorkItemsRoute('/work-items/wi-1001');

    expect(await screen.findByText('Details')).toBeTruthy();
    const statusBadges = await screen.findAllByText(wi.status);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('shows not-found message for a missing work item ID', async () => {
    _mockWorkItemIsError = true;
    await renderWorkItemsRoute('/work-items/wi-does-not-exist');

    expect(await screen.findByText(/does not exist or could not be loaded/i)).toBeTruthy();
  });
});
