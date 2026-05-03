// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createCockpitRouter } from '@/router';
import { queryClient } from '@/lib/query-client';
import type { ProjectSummary } from '@portarium/cockpit-types';

const OFFLINE_META = {
  isOffline: false,
  isStaleData: false,
  dataSource: 'network' as const,
  lastSyncAtIso: undefined,
};

const PROJECTS: ProjectSummary[] = [
  {
    schemaVersion: 1,
    projectId: 'proj-finance-controls',
    workspaceId: 'ws-demo',
    name: 'Finance Controls',
    status: 'Active',
    governancePosture: 'Blocked',
    governance: {
      ownerUserIds: ['user-ops-alex', 'user-approver-dana'],
      policyIds: ['FINANCE-APPROVAL-001'],
      defaultExecutionTier: 'HumanApprove',
      evidenceDepth: 'deep',
      allowedActionClasses: ['finance.reconcile'],
      blockedActionClasses: ['finance.pay-large-supplier-without-approval'],
    },
    metrics: {
      workItemCount: 3,
      activeRunCount: 1,
      pendingApprovalCount: 2,
      evidenceCount: 5,
      artifactCount: 1,
      policyViolationCount: 1,
    },
    latestActivityAtIso: '2026-05-01T09:00:00.000Z',
    summary: 'Invoice remediation and supplier payment governance.',
  },
  {
    schemaVersion: 1,
    projectId: 'proj-people-access',
    workspaceId: 'ws-demo',
    name: 'People Access',
    status: 'Paused',
    governancePosture: 'Clear',
    governance: {
      ownerUserIds: ['user-admin'],
      policyIds: ['IAM-APPROVAL-002'],
      defaultExecutionTier: 'Assisted',
      evidenceDepth: 'standard',
      allowedActionClasses: ['iam.review'],
      blockedActionClasses: ['iam.grant-admin-without-approval'],
    },
    metrics: {
      workItemCount: 1,
      activeRunCount: 0,
      pendingApprovalCount: 0,
      evidenceCount: 2,
      artifactCount: 0,
      policyViolationCount: 0,
    },
    latestActivityAtIso: '2026-04-30T09:00:00.000Z',
    summary: 'IAM review and HRIS sync governance.',
  },
];

vi.mock('@/hooks/queries/use-projects', () => ({
  useProjects: vi.fn(() => ({
    data: { items: PROJECTS },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    offlineMeta: OFFLINE_META,
  })),
}));

vi.mock('@/hooks/queries/use-approvals', () => ({
  useApprovals: vi.fn(() => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    offlineMeta: OFFLINE_META,
  })),
}));

async function renderProjectsRoute() {
  const router = createCockpitRouter({
    history: createMemoryHistory({ initialEntries: ['/projects'] }),
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
});

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('Projects portfolio route', () => {
  it('renders Projects as a Workspace-level portfolio', async () => {
    await renderProjectsRoute();

    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect((await screen.findAllByText('Finance Controls')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('People Access')).length).toBeGreaterThan(0);
  });

  it('surfaces governance posture and Project guardrails', async () => {
    await renderProjectsRoute();

    expect(await screen.findByText('Governance Surface')).toBeTruthy();
    expect(await screen.findAllByText('Blocked')).toHaveLength(2);
    expect(await screen.findByText('finance.pay-large-supplier-without-approval')).toBeTruthy();
  });

  it('shows portfolio totals', async () => {
    await renderProjectsRoute();

    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy();
    expect(await screen.findByText('Policy Violations')).toBeTruthy();
    expect(await screen.findAllByText('1')).toBeTruthy();
  });
});
