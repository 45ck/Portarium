export type CockpitRuntimeMode = 'demo' | 'dev-live' | 'live';

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

function flagEnabled(value: string | boolean | undefined, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function mockServiceWorkerEnabled(env: CockpitEnvLike): boolean {
  return flagEnabled(env.VITE_PORTARIUM_ENABLE_MSW, env.DEV === true);
}

export function getCockpitDataRetentionPolicy(
  env: CockpitEnvLike = import.meta.env,
): CockpitDataRetentionPolicy {
  const demoMode = flagEnabled(env.VITE_DEMO_MODE) || mockServiceWorkerEnabled(env);
  const allowLiveOfflineCache = flagEnabled(env.VITE_PORTARIUM_ENABLE_LIVE_OFFLINE_CACHE);
  const allowOfflineTenantData = demoMode || allowLiveOfflineCache;
  const runtimeMode: CockpitRuntimeMode = demoMode ? 'demo' : env.DEV ? 'dev-live' : 'live';

  return {
    runtimeMode,
    usesLiveTenantData: !demoMode,
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
