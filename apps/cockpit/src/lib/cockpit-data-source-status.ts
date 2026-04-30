import type { AuthStatus } from '@/stores/auth-store';
import type { CockpitRuntime } from '@/lib/cockpit-runtime';
import type { OfflineQueryMeta } from '@/hooks/queries/use-offline-query';

export type CockpitDataSourceState =
  | 'live'
  | 'demo'
  | 'cached'
  | 'offline'
  | 'stale'
  | 'unauthorized'
  | 'degraded'
  | 'connecting';

export interface QueryCacheSnapshot {
  readonly hasQueries: boolean;
  readonly hasData: boolean;
  readonly hasError: boolean;
  readonly hasUnauthorizedError: boolean;
  readonly isFetching: boolean;
  readonly latestUpdatedAtMs?: number;
}

export interface CockpitDataSourceStatus {
  readonly state: CockpitDataSourceState;
  readonly label: string;
  readonly detail: string;
  readonly workspaceId: string;
  readonly modeLabel: string;
  readonly lastUpdatedAtMs?: number;
  readonly ageLabel?: string;
  readonly canUseLiveActions: boolean;
}

const STALE_AFTER_MS = 60_000;

export function formatDataAge(ageMs: number): string {
  const safeAgeMs = Math.max(0, ageMs);
  if (safeAgeMs < 5_000) return 'just now';
  if (safeAgeMs < 60_000) return `${Math.floor(safeAgeMs / 1000)}s ago`;
  if (safeAgeMs < 60 * 60_000) return `${Math.floor(safeAgeMs / 60_000)}m ago`;
  if (safeAgeMs < 24 * 60 * 60_000) return `${Math.floor(safeAgeMs / (60 * 60_000))}h ago`;
  return `${Math.floor(safeAgeMs / (24 * 60 * 60_000))}d ago`;
}

export function runtimeModeLabel(runtime: CockpitRuntime): string {
  if (runtime.runtimeMode === 'demo') return 'Demo';
  if (runtime.runtimeMode === 'dev-live') return 'Dev live';
  return 'Live';
}

export function deriveFreshnessState(
  offlineMeta: OfflineQueryMeta,
  nowMs = Date.now(),
): Pick<CockpitDataSourceStatus, 'state' | 'label' | 'detail' | 'ageLabel' | 'lastUpdatedAtMs'> {
  const lastUpdatedAtMs = offlineMeta.lastSyncAtIso
    ? Date.parse(offlineMeta.lastSyncAtIso)
    : undefined;
  const ageLabel =
    lastUpdatedAtMs && Number.isFinite(lastUpdatedAtMs)
      ? formatDataAge(nowMs - lastUpdatedAtMs)
      : undefined;

  if (offlineMeta.isOffline) {
    return {
      state: 'offline',
      label: 'Offline',
      detail: ageLabel ? `Last sync ${ageLabel}` : 'No sync timestamp',
      ageLabel,
      lastUpdatedAtMs,
    };
  }

  if (offlineMeta.isStaleData || offlineMeta.dataSource === 'cache') {
    return {
      state: 'cached',
      label: 'Cached',
      detail: ageLabel ? `Cached ${ageLabel}` : 'Cached data',
      ageLabel,
      lastUpdatedAtMs,
    };
  }

  if (offlineMeta.dataSource === 'network') {
    return {
      state: 'live',
      label: 'Live',
      detail: ageLabel ? `Updated ${ageLabel}` : 'Updated from API',
      ageLabel,
      lastUpdatedAtMs,
    };
  }

  return {
    state: 'connecting',
    label: 'Connecting',
    detail: 'Waiting for data',
    ageLabel,
    lastUpdatedAtMs,
  };
}

export function deriveCockpitDataSourceStatus(input: {
  runtime: CockpitRuntime;
  authStatus: AuthStatus;
  workspaceId: string;
  isOnline: boolean;
  snapshot: QueryCacheSnapshot;
  nowMs?: number;
}): CockpitDataSourceStatus {
  const nowMs = input.nowMs ?? Date.now();
  const modeLabel = runtimeModeLabel(input.runtime);
  const lastUpdatedAtMs = input.snapshot.latestUpdatedAtMs;
  const ageLabel =
    lastUpdatedAtMs && Number.isFinite(lastUpdatedAtMs)
      ? formatDataAge(nowMs - lastUpdatedAtMs)
      : undefined;

  if (!input.runtime.usesLiveTenantData) {
    return {
      state: 'demo',
      label: 'Demo',
      detail: `${input.workspaceId} fixture data`,
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (input.authStatus === 'unauthenticated' || input.authStatus === 'error') {
    return {
      state: 'unauthorized',
      label: 'Unauthorized',
      detail: 'Live API session required',
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (!input.isOnline) {
    return {
      state: 'offline',
      label: 'Offline',
      detail: ageLabel ? `Showing cache from ${ageLabel}` : 'Reconnect to refresh live data',
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (input.snapshot.hasUnauthorizedError) {
    return {
      state: 'unauthorized',
      label: 'Unauthorized',
      detail: 'Live API rejected this session',
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (input.snapshot.hasData && lastUpdatedAtMs && nowMs - lastUpdatedAtMs > STALE_AFTER_MS) {
    return {
      state: 'stale',
      label: 'Stale',
      detail: `Last update ${ageLabel}`,
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (input.snapshot.hasError) {
    return {
      state: 'degraded',
      label: 'Degraded',
      detail: input.snapshot.hasData ? 'Using last successful response' : 'API errors detected',
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: false,
    };
  }

  if (input.snapshot.hasData) {
    return {
      state: 'live',
      label: 'Live',
      detail: ageLabel ? `Updated ${ageLabel}` : 'Updated from API',
      workspaceId: input.workspaceId,
      modeLabel,
      lastUpdatedAtMs,
      ageLabel,
      canUseLiveActions: true,
    };
  }

  return {
    state: 'connecting',
    label: input.snapshot.isFetching || input.snapshot.hasQueries ? 'Connecting' : 'No data',
    detail: 'Waiting for live workspace data',
    workspaceId: input.workspaceId,
    modeLabel,
    canUseLiveActions: false,
  };
}
