// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';

const API_POLICIES = [
  {
    policyId: 'pol-live-001',
    name: 'Outbound Payment Approval',
    description: 'Payment actions above the workspace threshold require explicit approval.',
    status: 'Active',
    tier: 'HumanApprove',
    scope: 'payments',
    ruleCount: 1,
    affectedWorkflowIds: ['wf-payout-reconciliation'],
    ruleText: 'WHEN action.type = "payment:create" AND amount > 1000 THEN REQUIRE_APPROVAL',
    conditions: [
      { field: 'action.type', operator: 'eq', value: 'payment:create' },
      { field: 'amount', operator: 'gt', value: '1000' },
    ],
  },
  {
    policyId: 'pol-live-002',
    name: 'Low Risk Note Update',
    description: 'Internal note updates can run with assisted execution.',
    status: 'Active',
    tier: 'Assisted',
    scope: 'crm',
    ruleCount: 1,
    affectedWorkflowIds: ['wf-crm-dedup'],
    ruleText: 'WHEN action.type = "note:update" THEN ALLOW_ASSISTED',
    conditions: [{ field: 'action.type', operator: 'eq', value: 'note:update' }],
  },
] as const;

const API_APPROVALS = [
  {
    schemaVersion: 1,
    approvalId: 'apr-live-001',
    workspaceId: 'ws-demo',
    runId: 'run-live-001',
    planId: 'plan-live-001',
    prompt: 'Approve outbound payment to supplier',
    status: 'Pending',
    requestedAtIso: '2026-04-01T10:00:00.000Z',
    requestedByUserId: 'user-requestor',
    policyRule: {
      ruleId: 'pol-live-001',
      trigger: 'action.type = "payment:create" AND amount > 1000',
      tier: 'HumanApprove',
      blastRadius: ['FinanceAccounting', '1 payment'],
      irreversibility: 'partial',
    },
  },
] as const;

const API_RUNS = [
  {
    schemaVersion: 1,
    runId: 'run-live-001',
    workspaceId: 'ws-demo',
    workflowId: 'wf-payout-reconciliation',
    correlationId: 'corr-live-001',
    executionTier: 'HumanApprove',
    initiatedByUserId: 'user-requestor',
    status: 'WaitingForApproval',
    createdAtIso: '2026-04-01T09:55:00.000Z',
  },
] as const;

const API_SOD_CONSTRAINTS = [
  {
    constraintId: 'sod-live-001',
    name: 'Payment maker checker',
    description: 'Payment approver must differ from initiator.',
    status: 'Active',
    relatedPolicyIds: ['pol-live-001'],
    rolePair: 'Approver / Initiator',
    forbiddenAction: 'Self-approval',
    scope: 'payments',
  },
] as const;

const API_EVIDENCE = [
  {
    schemaVersion: 1,
    evidenceId: 'ev-policy-001',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-02T11:00:00.000Z',
    category: 'PolicyViolation',
    summary: 'pol-live-001 denied payment:create escalation after approval timeout drift',
    actor: { kind: 'System' },
    links: { runId: 'run-live-001' },
    hashSha256: 'hash-policy-001',
  },
  {
    schemaVersion: 1,
    evidenceId: 'ev-policy-002',
    workspaceId: 'ws-demo',
    occurredAtIso: '2026-04-02T12:00:00.000Z',
    category: 'Policy',
    summary: 'break-glass override recorded for FinanceAccounting approval coverage',
    actor: { kind: 'User', userId: 'user-admin' },
    links: { runId: 'run-live-001' },
    hashSha256: 'hash-policy-002',
  },
] as const;

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

function readFormValue(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  return '';
}

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');

    if (url.pathname === '/v1/workspaces') {
      return Promise.resolve(json({ items: [{ workspaceId: 'ws-demo', name: 'Demo Workspace' }] }));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/policies') {
      return Promise.resolve(json({ items: API_POLICIES }));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/policies/pol-live-001') {
      return Promise.resolve(json(API_POLICIES[0]));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/approvals') {
      return Promise.resolve(json({ items: API_APPROVALS }));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/runs') {
      return Promise.resolve(json({ items: API_RUNS }));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/sod-constraints') {
      return Promise.resolve(json({ items: API_SOD_CONSTRAINTS }));
    }

    if (url.pathname === '/v1/workspaces/ws-demo/evidence') {
      const category = url.searchParams.get('category');
      const items = category
        ? API_EVIDENCE.filter((entry) => entry.category === category)
        : API_EVIDENCE;
      return Promise.resolve(json({ items }));
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
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('localStorage', createMemoryStorage());
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
  vi.stubGlobal('fetch', createFetchMock());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Policy Studio route', () => {
  it('makes policy management start from operational posture in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    await renderPoliciesRoute();

    expect(await screen.findByRole('heading', { name: 'Policy Overview' })).toBeTruthy();
    expect(screen.getByText(/Operational policy posture/i)).toBeTruthy();
    expect(screen.getByText(/Posture By Execution Tier/i)).toBeTruthy();
    expect(screen.getByText(/Risky Capabilities/i)).toBeTruthy();
    expect(screen.getByText(/Noisy Approval Classes And Drift/i)).toBeTruthy();
    expect(screen.getByText(/Recent Overrides And Incidents/i)).toBeTruthy();
    expect(screen.getByText(/Ownership And Review State/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Policy Studio/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Capability Posture/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Outbound Payment Approval/i)).toBeTruthy();
  });

  it('shows an API-aligned authoring and simulation surface in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    await renderPoliciesRoute('/config/policies/studio');

    expect(await screen.findByRole('heading', { name: 'Policy Studio' })).toBeTruthy();
    expect(await screen.findByText(/Outbound Payment Approval/i)).toBeTruthy();
    expect(screen.getAllByText(/Current Rule/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Proposed Diff/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Expected Impact And Simulation/i)).toBeTruthy();
    expect(screen.getByText(/Backend policy lifecycle mutation is not wired/i)).toBeTruthy();
    const publishButton = screen.getByRole('button', { name: /Publish policy change/i });
    expect(publishButton instanceof HTMLButtonElement && publishButton.disabled).toBe(true);
    expect(screen.queryByText(/Simulation lab/i)).toBeNull();
    expect(screen.queryByText(/Runtime precedent to policy/i)).toBeNull();
  });

  it('stages a local policy-blocked draft and rationale in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    await renderPoliciesRoute('/config/policies/studio');

    await userEvent.click(await screen.findByRole('button', { name: /Set Manual Only/i }));
    await userEvent.click(
      screen.getByLabelText(/Treat matching future actions as policy-blocked/i),
    );
    await userEvent.type(screen.getByLabelText(/Rationale/i), 'Escalate payouts.');

    expect(screen.getAllByText(/Policy-blocked/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Risky change/i)).toBeTruthy();
    expect(screen.getByText(/pending approvals matched/i)).toBeTruthy();
    expect(screen.getByText(/runs in affected Workflows/i)).toBeTruthy();
    expect(screen.getByText(/SoD constraints in scope/i)).toBeTruthy();
    expect(screen.getByText(/Would be policy-blocked/i)).toBeTruthy();
    expect(screen.getByText(/Captured for review/i)).toBeTruthy();
  });

  it('renders API policy detail data in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    await renderPoliciesRoute('/config/policies/pol-live-001');

    expect(await screen.findByRole('heading', { name: 'Outbound Payment Approval' })).toBeTruthy();
    expect(screen.getByText(/payment:create/i)).toBeTruthy();
    expect(screen.getByText(/Detail edits are local simulation only/i)).toBeTruthy();
    expect(screen.getByText(/Expected Impact And Simulation/i)).toBeTruthy();
    expect(screen.queryByText(/Bulk Email Deletion Block/i)).toBeNull();
  });

  it('does not expose fixture blast-radius data in dev-live mode', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'false');

    await renderPoliciesRoute('/config/blast-radius');

    expect(await screen.findByRole('heading', { name: 'Tool Blast Radius' })).toBeTruthy();
    expect(screen.getByText(/fixture-backed matrix is available only/i)).toBeTruthy();
    expect(screen.queryByText(/gmail:bulk-delete/i)).toBeNull();
  });

  it('renders the prototype surface and its primary sections', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    await renderPoliciesRoute('/config/policies/studio');

    expect(await screen.findByRole('heading', { name: 'Policy Studio' })).toBeTruthy();
    expect(
      await screen.findByText(/Start from a live case, stage the future default/i),
    ).toBeTruthy();
    expect(await screen.findByText(/Applies now: decide the live approval/i)).toBeTruthy();
    expect(await screen.findByText(/Applies after publish: future Policy default/i)).toBeTruthy();
    expect(await screen.findByText(/Capability posture matrix/i)).toBeTruthy();
    expect(await screen.findByText(/Simulation lab/i)).toBeTruthy();
    expect(await screen.findByText(/Runtime precedent to policy/i)).toBeTruthy();
  });

  it('shows explicit working context and time-horizon cues', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    await renderPoliciesRoute(
      '/config/policies/studio?slice=CRON-CREATE-BLOCK-001&precedent=precedent-persistent-cron&scenario=apr-oc-3205&draftTier=ManualOnly&draftEvidence=Diff%20artifact%7C%7CRollback%20plan%7C%7CConnector%20posture%20check%7C%7CPolicy%20trace&draftRationale=Escalate%20schedule%20creation%20to%20a%20control-room%20review%20path',
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
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    await renderPoliciesRoute('/config/policies/studio');

    await userEvent.click(
      await screen.findByRole('button', { name: /Persistent cron creation request/i }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /Apply to draft/i }));

    const rationale = await screen.findByLabelText(/Rationale capture/i);
    expect(readFormValue(rationale)).toContain(
      'Escalate schedule creation to a control-room review path',
    );
  });

  it('offers a focused handoff into the approvals triage deck', async () => {
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    await renderPoliciesRoute('/config/policies/studio');

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
    vi.stubEnv('VITE_PORTARIUM_ENABLE_MSW', 'true');

    await renderPoliciesRoute(
      '/config/policies/studio?slice=CRON-CREATE-BLOCK-001&precedent=precedent-persistent-cron&scenario=apr-oc-3205&draftTier=ManualOnly&draftEvidence=Diff%20artifact%7C%7CRollback%20plan%7C%7CConnector%20posture%20check%7C%7CPolicy%20trace&draftRationale=Escalate%20schedule%20creation%20to%20a%20control-room%20review%20path',
    );

    expect(
      (await screen.findAllByText(/Persistent cron creation request/i)).length,
    ).toBeGreaterThan(0);

    const rationale = await screen.findByLabelText(/Rationale capture/i);
    expect(readFormValue(rationale)).toContain(
      'Escalate schedule creation to a control-room review path',
    );
    expect((await screen.findAllByText(/Draft staged/i)).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/Editing the future default because of apr-oc-3205/i),
    ).toBeTruthy();
  });
});
