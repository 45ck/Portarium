import {
  cockpitFlagEnabled,
  resolveCockpitRuntime,
  type CockpitRuntimeMode,
} from '@/lib/cockpit-runtime';

export type { CockpitRuntimeMode } from '@/lib/cockpit-runtime';

interface CockpitEnvLike {
  readonly DEV?: boolean;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_PORTARIUM_ENABLE_MSW?: string;
  readonly VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE?: string;
}

export interface CockpitDataRetentionPolicy {
  readonly runtimeMode: CockpitRuntimeMode;
  readonly usesLiveTenantData: boolean;
  readonly allowOfflineTenantData: boolean;
  readonly persistTenantQueryCache: boolean;
  readonly serviceWorkerTenantApiCache: boolean;
}

export function getCockpitDataRetentionPolicy(
  env: CockpitEnvLike = import.meta.env,
): CockpitDataRetentionPolicy {
  const runtime = resolveCockpitRuntime(env);
  const allowLiveOfflineCache = cockpitFlagEnabled(env.VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE);
  const demoMode = runtime.runtimeMode === 'demo';
  const allowOfflineTenantData = demoMode || allowLiveOfflineCache;

  return {
    runtimeMode: runtime.runtimeMode,
    usesLiveTenantData: runtime.usesLiveTenantData,
    allowOfflineTenantData,
    persistTenantQueryCache: allowOfflineTenantData,
    serviceWorkerTenantApiCache: allowOfflineTenantData,
  };
}

export function shouldAllowOfflineTenantData(
  policy: CockpitDataRetentionPolicy = getCockpitDataRetentionPolicy(),
): boolean {
  return policy.allowOfflineTenantData;
}
