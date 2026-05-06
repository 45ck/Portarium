// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import { APPROVALS } from '@/mocks/fixtures/demo';
import type { OfflineQueryMeta } from '@/hooks/queries/use-offline-query';
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
let _mockOfflineMeta: OfflineQueryMeta = {
  isOffline: false,
  isStaleData: false,
  dataSource: 'network',
};
let _mockPendingCount = 0;
const _mockRefetch = vi.fn();
const _mockSubmitDecision = vi.fn().mockResolvedValue({ queued: false });

vi.mock('@/hooks/queries/use-approvals', () => ({
  useApprovals: vi.fn(() => ({
    data: _mockIsLoading || _mockIsError ? undefined : { items: _mockApprovals },
    isLoading: _mockIsLoading,
    isError: _mockIsError,
    refetch: _mockRefetch,
    offlineMeta: _mockOfflineMeta,
  })),
  // useApproval not called by the triage page
  useApproval: vi.fn(),
  useApprovalDecision: vi.fn(),
}));

vi.mock('@/hooks/queries/use-approval-decision-outbox', () => ({
  useApprovalDecisionOutbox: vi.fn(() => ({
    submitDecision: _mockSubmitDecision,
    pendingCount: _mockPendingCount,
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

async function renderApprovalsRoute(
  initialEntry = '/approvals',
  options: { internalPolicyStudio?: boolean } = {},
) {
  if (initialEntry.includes('from=policy-studio') && options.internalPolicyStudio !== false) {
    vi.stubEnv('VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT', 'true');
  }

  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
}

beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
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
  _mockOfflineMeta = {
    isOffline: false,
    isStaleData: false,
    dataSource: 'network',
  };
  _mockPendingCount = 0;
  _mockRefetch.mockClear();
  _mockSubmitDecision.mockClear();
  queryClient.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Approvals triage page', () => {
  it('does not enable demo policy injection in dev-live mode even when demo search is present', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');
    _mockApprovals = [];

    await renderApprovalsRoute('/approvals?demo=true');

    expect(await screen.findByRole('heading', { name: 'Approvals', level: 1 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Policy tightened/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Policy relaxed/i })).toBeNull();

    window.dispatchEvent(
      new CustomEvent('portarium:policy-updated', {
        detail: {
          policyId: 'COMMUNICATION-APPROVAL-001',
          policyName: 'External Email Approval',
          changeDescription: 'Tier changed to ManualOnly',
          effect: 'tighten',
          affectedApprovalIds: ['apr-oc-3299'],
        },
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText(/apr-oc-3299/i)).toBeNull();
      expect(screen.queryByText(/Cron morning_brief auto-safe item/i)).toBeNull();
    });
  });

  it('does not enable demo policy injection in default mock mode without the internal flag', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    _mockApprovals = [];

    await renderApprovalsRoute('/approvals?demo=true');

    expect(await screen.findByRole('heading', { name: 'Approvals', level: 1 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Policy tightened/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Policy relaxed/i })).toBeNull();
  });

  it('treats policy-studio handoff search as ordinary approval focus without the internal flag', async () => {
    const focused = ALL_PENDING[0]!;
    vi.stubEnv('VITE_PORTARIUM_SHOW_INTERNAL_COCKPIT', 'false');

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001`,
      { internalPolicyStudio: false },
    );

    expect(await screen.findByRole('heading', { name: 'Approvals', level: 1 })).toBeTruthy();
    expect(screen.queryByText(/opened from policy studio/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /Back to Policy Studio/i })).toBeNull();
  });

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

  it('shows a policy-studio handoff banner when arriving with focus from the studio', async () => {
    const focused = ALL_PENDING[0]!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001&returnPrecedent=precedent-persistent-cron&returnDraftTier=ManualOnly&returnDraftRationale=${encodeURIComponent('Escalate schedule creation to a control-room review path')}`,
    );

    expect(await screen.findByText(/opened from policy studio/i)).toBeTruthy();
    expect(
      await screen.findByText(
        /Focused policy-linked review for the live case that led to the staged Policy draft/i,
      ),
    ).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Approval Review', level: 1 })).toBeTruthy();
    expect(screen.getAllByText(/focused policy-linked review/i).length).toBeGreaterThan(0);
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
    expect(await screen.findByText(/Decide this live case now/i)).toBeTruthy();
    expect((await screen.findAllByText('Proposed Action')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Why gated')).toBeTruthy();
    expect(await screen.findByText('Current recommendation')).toBeTruthy();
    expect(await screen.findByText('Evidence and policy context')).toBeTruthy();
    expect(await screen.findByText('Deep audit detail')).toBeTruthy();
    expect(await screen.findByText(/immediate Approval decision/i, { exact: false })).toBeTruthy();
    const backLink = await screen.findByRole('link', { name: /Back to Policy Studio/i });
    const href = backLink.getAttribute('href') ?? '';
    expect(href).toContain('/config/policies/studio');
    expect(href).toContain('slice=CRON-CREATE-BLOCK-001');
    expect(href).toContain('precedent=precedent-persistent-cron');
    expect(href).toContain('draftTier=ManualOnly');
    expect(href).toContain('draftRationale=');
    expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();
  });

  it('keeps cached-data warnings visible in policy-studio focused review', async () => {
    const focused = ALL_PENDING[0]!;
    _mockOfflineMeta = {
      isOffline: false,
      isStaleData: true,
      dataSource: 'cache',
      lastSyncAtIso: '2026-04-29T23:00:00.000Z',
    };

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001`,
    );

    expect(await screen.findByText(/showing cached data/i)).toBeTruthy();
    expect(screen.getByText(/approval context may have changed/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
    expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();
  });

  it('keeps offline warnings visible in policy-studio focused review', async () => {
    const focused = ALL_PENDING[0]!;
    _mockOfflineMeta = {
      isOffline: true,
      isStaleData: false,
      dataSource: 'cache',
      lastSyncAtIso: '2026-04-29T23:00:00.000Z',
    };

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001`,
    );

    expect(await screen.findByText(/offline mode active/i)).toBeTruthy();
    expect(screen.getByText(/approval context may have changed/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
  });

  it('keeps pending-sync warnings visible in policy-studio focused review', async () => {
    const focused = ALL_PENDING[0]!;
    _mockPendingCount = 2;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001`,
    );

    expect(await screen.findByText(/sync pending/i)).toBeTruthy();
    expect(screen.getByText(/2 queued approval decisions/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
  });

  it('keeps cached-data warnings visible in notification focused review', async () => {
    const focused = ALL_PENDING[1]!;
    _mockOfflineMeta = {
      isOffline: false,
      isStaleData: true,
      dataSource: 'cache',
      lastSyncAtIso: '2026-04-29T23:00:00.000Z',
    };

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=notification`,
    );

    expect(await screen.findByText(/showing cached data/i)).toBeTruthy();
    expect(screen.getByText(/approval context may have changed/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
  });

  it('does not advance to another approval after skipping a policy-studio focused review', async () => {
    const firstPending = ALL_PENDING[0]!;
    const focused = ALL_PENDING[1]!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001&returnPrecedent=precedent-persistent-cron`,
    );

    expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(
      () => {
        expect(screen.queryByText(/approval skipped/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );
    expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
    expect(screen.queryByText(firstPending.prompt, { exact: false })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Back to Policy Studio/i }).length).toBeGreaterThan(
      0,
    );
  });

  it.each([
    {
      label: 'approving',
      action: async () => {
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /^approve$/i }));
      },
    },
    {
      label: 'denying',
      action: async () => {
        await userEvent.type(screen.getByLabelText(/decision rationale/i), 'Reject risky spend');
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /deny/i }));
      },
    },
    {
      label: 'requesting changes',
      action: async () => {
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /changes/i }));
        fireEvent.change(
          screen.getByPlaceholderText(/describe what the requestor needs to update/i),
          { target: { value: 'Attach updated approval evidence' } },
        );
        await userEvent.click(screen.getByRole('button', { name: /submit request for changes/i }));
      },
    },
  ])(
    'does not advance to another approval after $label a policy-studio focused review',
    async ({ action }) => {
      const firstPending = ALL_PENDING[0]!;
      const focused = ALL_PENDING[1]!;

      await renderApprovalsRoute(
        `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001&returnPrecedent=precedent-persistent-cron`,
      );

      expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();

      await action();

      await waitFor(
        () => {
          expect(screen.queryByText(/approval handled/i)).toBeTruthy();
        },
        { timeout: 2000 },
      );
      expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
      expect(screen.queryByText(firstPending.prompt, { exact: false })).toBeNull();
      expect(
        screen.getAllByRole('link', { name: /Back to Policy Studio/i }).length,
      ).toBeGreaterThan(0);
    },
  );

  it('shows an explicit already-decided state for policy-studio focused reviews', async () => {
    const decided = APPROVALS.find((a) => a.status === 'Approved')!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(decided.approvalId)}&from=policy-studio&returnSlice=CRON-CREATE-BLOCK-001`,
    );

    expect(await screen.findByText(/approval already decided/i)).toBeTruthy();
    expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
    expect(screen.getByText(/staged Policy Studio draft is still preserved/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^approve$/i })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Back to Policy Studio/i }).length).toBeGreaterThan(
      0,
    );
  });

  it('shows an explicit not-found state for stale policy-studio focused reviews', async () => {
    await renderApprovalsRoute('/approvals?focus=apr-missing&from=policy-studio');

    expect(await screen.findByText(/approval not found/i)).toBeTruthy();
    expect(screen.getAllByText(/Policy Studio handoff/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^approve$/i })).toBeNull();
    expect(screen.getAllByRole('link', { name: /Back to Policy Studio/i }).length).toBeGreaterThan(
      0,
    );
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

  it('selects the focused approval when opened from a notification', async () => {
    const focused = ALL_PENDING[1]!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=notification`,
    );

    expect(await screen.findByText(/focused approval review/i)).toBeTruthy();
    expect(await screen.findByText(/waiting for your approval/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
    const matchingPrompts = await screen.findAllByText(focused.prompt, { exact: false });
    expect(matchingPrompts.length).toBeGreaterThan(0);
  });

  it('opens direct approval links as a single-case notification review', async () => {
    const focused = ALL_PENDING[1]!;

    await renderApprovalsRoute(`/approvals/${encodeURIComponent(focused.approvalId)}`);

    expect(await screen.findByText(/focused approval review/i)).toBeTruthy();
    expect(await screen.findByText('1 of 1 pending')).toBeTruthy();
    expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();
  });

  it('does not advance to another approval after skipping a notification deep link', async () => {
    const firstPending = ALL_PENDING[0]!;
    const focused = ALL_PENDING[1]!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=notification`,
    );

    expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /skip/i }));

    await waitFor(
      () => {
        expect(screen.queryByText(/approval skipped/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );
    expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
    expect(screen.queryByText(firstPending.prompt, { exact: false })).toBeNull();
  });

  it.each([
    {
      label: 'approving',
      action: async () => {
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /^approve$/i }));
      },
    },
    {
      label: 'denying',
      action: async () => {
        await userEvent.type(screen.getByLabelText(/decision rationale/i), 'Reject risky spend');
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /deny/i }));
      },
    },
    {
      label: 'requesting changes',
      action: async () => {
        const group = screen.getByRole('group', { name: /make approval decision/i });
        await userEvent.click(within(group).getByRole('button', { name: /changes/i }));
        fireEvent.change(
          screen.getByPlaceholderText(/describe what the requestor needs to update/i),
          { target: { value: 'Attach updated approval evidence' } },
        );
        await userEvent.click(screen.getByRole('button', { name: /submit request for changes/i }));
      },
    },
  ])(
    'does not advance to another approval after $label a notification deep link',
    async ({ action }) => {
      const firstPending = ALL_PENDING[0]!;
      const focused = ALL_PENDING[1]!;

      await renderApprovalsRoute(
        `/approvals?focus=${encodeURIComponent(focused.approvalId)}&from=notification`,
      );

      expect(await screen.findAllByText(focused.prompt, { exact: false })).toBeTruthy();

      await action();

      await waitFor(
        () => {
          expect(screen.queryByText(/approval handled/i)).toBeTruthy();
        },
        { timeout: 2000 },
      );
      expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
      expect(screen.queryByText(firstPending.prompt, { exact: false })).toBeNull();
    },
  );

  it('shows an explicit already-decided state for notification deep links', async () => {
    const decided = APPROVALS.find((a) => a.status === 'Approved')!;

    await renderApprovalsRoute(
      `/approvals?focus=${encodeURIComponent(decided.approvalId)}&from=notification`,
    );

    expect(await screen.findByText(/approval already decided/i)).toBeTruthy();
    expect(screen.getByText(/will not advance to another queued approval/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^approve$/i })).toBeNull();
  });

  it('shows an explicit not-found state for stale notification deep links', async () => {
    await renderApprovalsRoute('/approvals?focus=apr-missing&from=notification');

    expect(await screen.findByText(/approval not found/i)).toBeTruthy();
    expect(screen.getByText(/outdated link/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^approve$/i })).toBeNull();
  });

  it('disables Approve button when SoD state is blocked-self', async () => {
    const blockedApproval = APPROVALS.find((a) => a.sodEvaluation?.state === 'blocked-self')!;
    expect(blockedApproval).toBeDefined();

    _mockApprovals = [{ ...blockedApproval, status: 'Pending' }];

    await renderApprovalsRoute();

    expect(await screen.findAllByText(blockedApproval.prompt, { exact: false })).toBeTruthy();
    expect(
      (await screen.findAllByText(/you cannot approve your own request/i)).length,
    ).toBeGreaterThan(0);

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

  it('keeps the active approval in place when Deny is clicked without rationale', async () => {
    const firstPending = ALL_PENDING[0]!;
    const secondPending = ALL_PENDING[1]!;
    _mockApprovals = [firstPending, secondPending];

    await renderApprovalsRoute();

    expect(await screen.findAllByText(firstPending.prompt, { exact: false })).toBeTruthy();

    const group = screen.getByRole('group', { name: /make approval decision/i });
    await userEvent.click(within(group).getByRole('button', { name: /deny/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryAllByText(firstPending.prompt, { exact: false }).length).toBeGreaterThan(0);
    expect(_mockSubmitDecision).not.toHaveBeenCalled();
  });
});
