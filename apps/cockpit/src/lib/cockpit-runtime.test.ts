import { describe, expect, it } from 'vitest';
import {
  DATASET_STORAGE_KEY,
  resolveCockpitRuntime,
  resolveStoredDataset,
  shouldEnableCockpitMocks,
  workspaceIdForDataset,
} from '@/lib/cockpit-runtime';

function storageWithDataset(dataset: string): Storage {
  return {
    get length() {
      return 1;
    },
    clear() {},
    getItem(key: string) {
      return key === DATASET_STORAGE_KEY ? dataset : null;
    },
    key() {
      return DATASET_STORAGE_KEY;
    },
    removeItem() {},
    setItem() {},
  };
}

describe('cockpit runtime mode', () => {
  it('treats dev MSW as explicit demo runtime by default', () => {
    expect(resolveCockpitRuntime({ DEV: true })).toMatchObject({
      runtimeMode: 'demo',
      mockServiceWorkerEnabled: true,
      usesLiveTenantData: false,
      allowDemoControls: true,
    });
  });

  it('treats VITE_PORTARIUM_ENABLE_MSW=false as dev-live', () => {
    expect(shouldEnableCockpitMocks({ DEV: true, VITE_PORTARIUM_ENABLE_MSW: 'false' })).toBe(false);
    expect(resolveCockpitRuntime({ DEV: true, VITE_PORTARIUM_ENABLE_MSW: 'false' })).toMatchObject({
      runtimeMode: 'dev-live',
      mockServiceWorkerEnabled: false,
      usesLiveTenantData: true,
      allowDemoControls: false,
    });
  });

  it('does not start MSW fixtures for explicit dev-live mode', () => {
    expect(shouldEnableCockpitMocks({ DEV: true, VITE_DEMO_MODE: 'false' })).toBe(false);
    expect(resolveCockpitRuntime({ DEV: true, VITE_DEMO_MODE: 'false' })).toMatchObject({
      runtimeMode: 'dev-live',
      mockServiceWorkerEnabled: false,
      usesLiveTenantData: true,
      allowDemoControls: false,
    });
  });

  it('does not allow demo controls in production without MSW even when demo mode is requested', () => {
    expect(resolveCockpitRuntime({ DEV: false, VITE_DEMO_MODE: 'true' })).toMatchObject({
      runtimeMode: 'live',
      mockServiceWorkerEnabled: false,
      usesLiveTenantData: true,
      allowDemoControls: false,
    });
  });

  it('does not allow demo controls in dev-live when MSW is disabled explicitly', () => {
    expect(
      resolveCockpitRuntime({
        DEV: true,
        VITE_DEMO_MODE: 'true',
        VITE_PORTARIUM_ENABLE_MSW: 'false',
      }),
    ).toMatchObject({
      runtimeMode: 'dev-live',
      mockServiceWorkerEnabled: false,
      usesLiveTenantData: true,
      allowDemoControls: false,
    });
  });

  it('ignores stale fixture dataset storage outside demo runtime', () => {
    expect(
      resolveStoredDataset(
        { DEV: true, VITE_PORTARIUM_ENABLE_MSW: 'false' },
        storageWithDataset('openclaw-demo'),
      ),
    ).toBe('live');
  });

  it('ignores the misleading mock live dataset in demo runtime', () => {
    expect(resolveStoredDataset({ DEV: true }, storageWithDataset('live'))).toBe('meridian-demo');
  });

  it('allows the Growth Studio fixture dataset from env and maps it to its workspace', () => {
    expect(
      resolveStoredDataset({
        DEV: true,
        VITE_PORTARIUM_MOCK_DATASET: 'growth-studio',
      }),
    ).toBe('growth-studio');
    expect(workspaceIdForDataset('growth-studio')).toBe('ws-growth-studio');
  });
});
