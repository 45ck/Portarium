import { describe, expect, it } from 'vitest';
import { getCockpitDataRetentionPolicy } from '@/lib/cockpit-data-retention';

describe('cockpit data retention policy', () => {
  it('allows offline tenant data for demo/MSW mode', () => {
    expect(
      getCockpitDataRetentionPolicy({
        DEV: true,
        VITE_PORTARIUM_ENABLE_MSW: 'true',
      }),
    ).toMatchObject({
      runtimeMode: 'demo',
      usesLiveTenantData: false,
      allowOfflineTenantData: true,
      serviceWorkerTenantApiCache: true,
    });
  });

  it('blocks offline tenant data for live API QA by default', () => {
    expect(
      getCockpitDataRetentionPolicy({
        DEV: true,
        VITE_PORTARIUM_ENABLE_MSW: 'false',
      }),
    ).toMatchObject({
      runtimeMode: 'dev-live',
      usesLiveTenantData: true,
      allowOfflineTenantData: false,
      persistTenantQueryCache: false,
      serviceWorkerTenantApiCache: false,
    });
  });

  it('requires an explicit opt-in for live offline cache', () => {
    expect(
      getCockpitDataRetentionPolicy({
        DEV: false,
        VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE: 'true',
      }).allowOfflineTenantData,
    ).toBe(true);
  });
});
