import { describe, expect, it } from 'vitest';
import {
  deriveCockpitDataSourceStatus,
  deriveFreshnessState,
} from '@/lib/cockpit-data-source-status';
import type { CockpitRuntime } from '@/lib/cockpit-runtime';

const liveRuntime: CockpitRuntime = {
  runtimeMode: 'live',
  mockServiceWorkerEnabled: false,
  usesLiveTenantData: true,
  allowDemoControls: false,
};

const demoRuntime: CockpitRuntime = {
  runtimeMode: 'demo',
  mockServiceWorkerEnabled: true,
  usesLiveTenantData: false,
  allowDemoControls: true,
};

describe('cockpit data source status', () => {
  it('marks demo runtime as non-live even with cached query data', () => {
    expect(
      deriveCockpitDataSourceStatus({
        runtime: demoRuntime,
        authStatus: 'authenticated',
        workspaceId: 'ws-demo',
        isOnline: true,
        snapshot: {
          hasQueries: true,
          hasData: true,
          hasError: false,
          hasUnauthorizedError: false,
          isFetching: false,
          latestUpdatedAtMs: 1000,
        },
        nowMs: 2000,
      }),
    ).toMatchObject({
      state: 'demo',
      label: 'Demo',
      canUseLiveActions: false,
    });
  });

  it('marks live data as stale after the freshness window', () => {
    expect(
      deriveCockpitDataSourceStatus({
        runtime: liveRuntime,
        authStatus: 'authenticated',
        workspaceId: 'ws-prod',
        isOnline: true,
        snapshot: {
          hasQueries: true,
          hasData: true,
          hasError: false,
          hasUnauthorizedError: false,
          isFetching: false,
          latestUpdatedAtMs: 1,
        },
        nowMs: 70_001,
      }),
    ).toMatchObject({
      state: 'stale',
      canUseLiveActions: false,
    });
  });

  it('uses unauthorized ahead of cached live data', () => {
    expect(
      deriveCockpitDataSourceStatus({
        runtime: liveRuntime,
        authStatus: 'authenticated',
        workspaceId: 'ws-prod',
        isOnline: true,
        snapshot: {
          hasQueries: true,
          hasData: true,
          hasError: true,
          hasUnauthorizedError: true,
          isFetching: false,
          latestUpdatedAtMs: 60_000,
        },
        nowMs: 70_000,
      }),
    ).toMatchObject({
      state: 'unauthorized',
      label: 'Unauthorized',
      canUseLiveActions: false,
    });
  });

  it('derives offline query freshness from cache metadata', () => {
    expect(
      deriveFreshnessState(
        {
          isOffline: true,
          isStaleData: true,
          dataSource: 'cache',
          lastSyncAtIso: '2026-04-30T00:00:00.000Z',
        },
        Date.parse('2026-04-30T00:03:00.000Z'),
      ),
    ).toMatchObject({
      state: 'offline',
      label: 'Offline',
      ageLabel: '3m ago',
    });
  });
});
