// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { APPROVALS } from '@/mocks/fixtures/demo';
import type { ApprovalSummary } from '@portarium/cockpit-types';

// ---------------------------------------------------------------------------
// Mock the approvals + outbox hooks so tests are independent of the singleton
// controlPlaneClient whose `fetchImpl` is captured at module init time.
// ---------------------------------------------------------------------------

const ALL_PENDING = APPROVALS.filter((a) => a.status === 'Pending');

// Mutable state shared with the mock factory below
let _mockApprovals: ApprovalSummary[] = [...APPROVALS];
let _mockIsLoading = false;
let _mockIsError = false;
const _mockRefetch = vi.fn();
const _mockSubmitDecision = vi.fn().mockResolvedValue({ queued: false });

vi.mock('@/hooks/queries/use-approvals', () => ({
  useApprovals: vi.fn(() => ({
    data: _mockIsLoading || _mockIsError ? undefined : { items: _mockApprovals },
    isLoading: _mockIsLoading,
    isError: _mockIsError,
    refetch: _mockRefetch,
    offlineMeta: {
      isOffline: false,
      isStaleData: false,
      dataSource: 'network' as const,
      lastSyncAtIso: undefined,
    },
  })),
  // useApproval not called by the triage page
  useApproval: vi.fn(),
  useApprovalDecision: vi.fn(),
}));

vi.mock('@/hooks/queries/use-approval-decision-outbox', () => ({
  useApprovalDecisionOutbox: vi.fn(() => ({
    submitDecision: _mockSubmitDecision,
    pendingCount: 0,
    isFlushing: false,
    flushNow: vi.fn(),
  })),
}));

// Stub supplementary queries with empty results so the card renders safely
vi.mock('@/hooks/queries/use-plan', () => ({
  usePlan: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/queries/use-evidence', () => ({
  useEvidence: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/queries/use-runs', () => ({
  useRuns: vi.fn(() => ({ data: undefined })),
  useRun: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/queries/use-workflows', () => ({
  useWorkflows: vi.fn(() => ({ data: undefined })),
  useWorkflow: vi.fn(() => ({ data: undefined })),
}));

// ---------------------------------------------------------------------------

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

async function renderApprovalsRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/approvals'] }),
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
  _mockApprovals = [...APPROVALS];
  _mockIsLoading = false;
  _mockIsError = false;
  _mockRefetch.mockClear();
  _mockSubmitDecision.mockClear();
  queryClient.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Approvals triage page', () => {
  it('renders the Approvals heading', async () => {
    await renderApprovalsRoute();

    // The page has an h1 (PageHeader) and an h2 (ApprovalListPanel sidebar).
    // Use level: 1 to find only the primary page heading.
    expect(await screen.findByRole('heading', { name: 'Approvals', level: 1 })).toBeTruthy();
  });

  it('shows the first pending approval prompt in the triage deck', async () => {
    await renderApprovalsRoute();

    const firstPending = ALL_PENDING[0]!;
    // The prompt appears in both the list panel and the triage card; findAllByText
    // succeeds when one or more elements match.
    expect(await screen.findAllByText(firstPending.prompt, { exact: false })).toBeTruthy();
  });

  it('renders Approve, Deny, and Skip action buttons for pending approvals', async () => {
    await renderApprovalsRoute();

    // Approve button text matches list-panel item buttons (prompts start with "Approve…")
    // so use findAllByRole which succeeds on 1+ matches.
    expect(await screen.findAllByRole('button', { name: /approve/i })).toBeTruthy();
    // Deny and Skip are unique to the triage card action bar.
    expect(await screen.findByRole('button', { name: /deny/i })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /skip/i })).toBeTruthy();
  });

  it('shows empty state when there are no pending approvals', async () => {
    _mockApprovals = APPROVALS.filter((a) => a.status !== 'Pending');

    await renderApprovalsRoute();

    expect(await screen.findByText(/all caught up/i)).toBeTruthy();
  });

  it('shows error banner when approvals fetch fails', async () => {
    _mockIsError = true;

    await renderApprovalsRoute();

    expect(await screen.findByText(/failed to load approvals/i)).toBeTruthy();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('advances to the next approval after skipping the current one', async () => {
    await renderApprovalsRoute();

    const firstPending = ALL_PENDING[0]!;
    const secondPending = ALL_PENDING[1]!;

    expect(await screen.findAllByText(firstPending.prompt, { exact: false })).toBeTruthy();

    const skipBtn = screen.getByRole('button', { name: /skip/i });
    await userEvent.click(skipBtn);

    // handleCardAction fires onAction after a 150 ms setTimeout; waitFor polls until
    // the second approval appears (list panel and/or triage card).
    await waitFor(
      () => {
        expect(
          screen.queryAllByText(secondPending.prompt, { exact: false }).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );
  });

  it('disables Approve button when SoD state is blocked-self', async () => {
    const blockedApproval = APPROVALS.find((a) => a.sodEvaluation?.state === 'blocked-self')!;
    expect(blockedApproval).toBeDefined();

    _mockApprovals = [{ ...blockedApproval, status: 'Pending' }];

    await renderApprovalsRoute();

    expect(await screen.findAllByText(blockedApproval.prompt, { exact: false })).toBeTruthy();
    expect(await screen.findByText(/you cannot approve your own request/i)).toBeTruthy();

    // The action-bar group is labelled "Make approval decision"; scope there to
    // get the unique Approve button rather than matching list-panel item buttons.
    const group = screen.getByRole('group', { name: /make approval decision/i });
    const approveBtn = within(group).getByRole('button', { name: /approve/i }) as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
  });

  it('shows session complete state after all items are actioned', async () => {
    // Single pending approval — one Skip clears the queue.
    _mockApprovals = [ALL_PENDING[0]!];

    await renderApprovalsRoute();

    expect(await screen.findAllByText(ALL_PENDING[0]!.prompt, { exact: false })).toBeTruthy();

    const skipBtn = screen.getByRole('button', { name: /skip/i });
    await userEvent.click(skipBtn);

    // TriageCompleteState renders "Queue cleared" after the 150 ms animation delay.
    await waitFor(
      () => {
        expect(screen.queryByText(/queue cleared/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    // "Review N skipped items" button appears since we skipped 1 item.
    expect(screen.getByRole('button', { name: /review.*skipped/i })).toBeTruthy();
  });
});
