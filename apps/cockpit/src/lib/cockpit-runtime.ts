export type CockpitRuntimeMode = 'demo' | 'dev-live' | 'live';

export type DatasetId = 'live' | 'demo' | 'openclaw-demo' | 'meridian-demo' | 'meridian-full';

export const DATASET_STORAGE_KEY = 'portarium-dataset';

export const DEFAULT_DEMO_DATASET_ID: DatasetId = 'meridian-demo';

export const DATASET_WORKSPACE_MAP: Record<DatasetId, string> = {
  live: import.meta.env.VITE_PORTARIUM_DEFAULT_WORKSPACE_ID ?? 'ws-local-dev',
  demo: 'ws-demo',
  'openclaw-demo': 'ws-demo',
  'meridian-demo': 'ws-meridian',
  'meridian-full': 'ws-meridian',
};

export const DATASET_IDS = Object.keys(DATASET_WORKSPACE_MAP) as DatasetId[];

interface CockpitEnvLike {
  readonly DEV?: boolean;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_PORTARIUM_ENABLE_MSW?: string;
  readonly VITE_PORTARIUM_MOCK_DATASET?: string;
}

interface StorageLike {
  getItem(key: string): string | null;
}

export interface CockpitRuntime {
  readonly runtimeMode: CockpitRuntimeMode;
  readonly mockServiceWorkerEnabled: boolean;
  readonly usesLiveTenantData: boolean;
  readonly allowDemoControls: boolean;
}

export function cockpitFlagEnabled(
  value: string | boolean | undefined,
  defaultValue = false,
): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function isDatasetId(value: string | null | undefined): value is DatasetId {
  return DATASET_IDS.includes(value as DatasetId);
}

export function isDemoDatasetId(value: DatasetId): boolean {
  return value !== 'live';
}

export function shouldEnableCockpitMocks(env: CockpitEnvLike = import.meta.env): boolean {
  if (env.DEV !== true) return false;
  return cockpitFlagEnabled(env.VITE_PORTARIUM_ENABLE_MSW, true);
}

export function resolveCockpitRuntime(env: CockpitEnvLike = import.meta.env): CockpitRuntime {
  const mockServiceWorkerEnabled = shouldEnableCockpitMocks(env);
  const demoMode = cockpitFlagEnabled(env.VITE_DEMO_MODE) || mockServiceWorkerEnabled;
  const runtimeMode: CockpitRuntimeMode = demoMode ? 'demo' : env.DEV ? 'dev-live' : 'live';

  return {
    runtimeMode,
    mockServiceWorkerEnabled,
    usesLiveTenantData: !demoMode,
    allowDemoControls: demoMode,
  };
}

export function resolveStoredDataset(
  env: CockpitEnvLike = import.meta.env,
  storage?: StorageLike,
): DatasetId {
  const runtime = resolveCockpitRuntime(env);
  if (!runtime.allowDemoControls) return 'live';

  const envPreferred = (env.VITE_PORTARIUM_MOCK_DATASET ?? '').trim();
  if (isDatasetId(envPreferred) && isDemoDatasetId(envPreferred)) return envPreferred;

  const stored = storage?.getItem(DATASET_STORAGE_KEY);
  if (isDatasetId(stored) && isDemoDatasetId(stored)) return stored;

  return DEFAULT_DEMO_DATASET_ID;
}

export function workspaceIdForDataset(datasetId: DatasetId): string {
  return DATASET_WORKSPACE_MAP[datasetId];
}
