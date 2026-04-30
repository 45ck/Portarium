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

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');

    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] }));
    }

    if (url.pathname.includes('/approvals')) {
      return Promise.resolve(json({ items: [] }));
    }

    return Promise.resolve(json({ items: [] }));
  });
}

async function renderPoliciesRoute(initialEntry = '/config/policies') {
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
  queryClient.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Policy Studio route', () => {
  it('renders the prototype surface and its primary sections', async () => {
    await renderPoliciesRoute();

    expect(await screen.findByRole('heading', { name: 'Policy Studio' })).toBeTruthy();
    expect(
      await screen.findByText(
        /Review the live case, stage the future default, then return to the approval/i,
      ),
    ).toBeTruthy();
    expect(await screen.findByText(/Applies now: decide the live approval/i)).toBeTruthy();
    expect(await screen.findByText(/Applies after publish: future Policy default/i)).toBeTruthy();
    expect(await screen.findByText(/Capability posture matrix/i)).toBeTruthy();
    expect(await screen.findByText(/Simulation lab/i)).toBeTruthy();
    expect(await screen.findByText(/Runtime precedent to policy/i)).toBeTruthy();
  });

  it('shows explicit working context and time-horizon cues', async () => {
    await renderPoliciesRoute(
      '/config/policies?slice=CRON-CREATE-BLOCK-001&precedent=precedent-persistent-cron&scenario=apr-oc-3205&draftTier=ManualOnly&draftEvidence=Diff%20artifact%7C%7CRollback%20plan%7C%7CConnector%20posture%20check%7C%7CPolicy%20trace&draftRationale=Escalate%20schedule%20creation%20to%20a%20control-room%20review%20path',
    );

    expect(await screen.findByText(/Current live case/i)).toBeTruthy();
    expect(await screen.findAllByText(/Future default draft/i)).toBeTruthy();
    expect(await screen.findAllByText(/Published default today/i)).toBeTruthy();
    expect(await screen.findByText(/Current approval work/i)).toBeTruthy();
    expect(await screen.findByText(/Future policy work/i)).toBeTruthy();
    expect(await screen.findByText(/This draft does not decide the live approval/i)).toBeTruthy();
    expect((await screen.findAllByText(/Applies now/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Applies after publish/i)).length).toBeGreaterThan(0);
  });

  it('applies a runtime precedent into the draft state', async () => {
    await renderPoliciesRoute();

    await userEvent.click(
      await screen.findByRole('button', { name: /Persistent cron creation request/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Apply to draft/i }));

    const rationale = (await screen.findByLabelText(/Rationale capture/i)) as HTMLTextAreaElement;
    expect(rationale.value).toContain('Escalate schedule creation to a control-room review path');
  });

  it('offers a focused handoff into the approvals triage deck', async () => {
    await renderPoliciesRoute();

    await userEvent.click(
      await screen.findByRole('button', { name: /Persistent cron creation request/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Apply to draft/i }));

    const handoffLink = await screen.findByRole('link', { name: /Open focused review/i });
    const href = handoffLink.getAttribute('href') ?? '';

    expect(href).toContain('/approvals');
    expect(href).toContain('demo=true');
    expect(href).toContain('from=policy-studio');
    expect(href).toContain('focus=');
    expect(href).toContain('returnSlice=CRON-CREATE-BLOCK-001');
    expect(href).toContain('returnPrecedent=precedent-persistent-cron');
    expect(href).toContain('returnScenario=apr-oc-3205');
    expect(href).toContain('returnDraftRationale=');
  });

  it('hydrates the staged draft from search params after a return trip', async () => {
    await renderPoliciesRoute(
      '/config/policies?slice=CRON-CREATE-BLOCK-001&precedent=precedent-persistent-cron&scenario=apr-oc-3205&draftTier=ManualOnly&draftEvidence=Diff%20artifact%7C%7CRollback%20plan%7C%7CConnector%20posture%20check%7C%7CPolicy%20trace&draftRationale=Escalate%20schedule%20creation%20to%20a%20control-room%20review%20path',
    );

    expect(
      (await screen.findAllByText(/Persistent cron creation request/i)).length,
    ).toBeGreaterThan(0);

    const rationale = (await screen.findByLabelText(/Rationale capture/i)) as HTMLTextAreaElement;
    expect(rationale.value).toContain('Escalate schedule creation to a control-room review path');
    expect((await screen.findAllByText(/Draft staged/i)).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/Editing the future default because of apr-oc-3205/i),
    ).toBeTruthy();
  });
});
