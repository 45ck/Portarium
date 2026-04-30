import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CockpitApiError } from '@/lib/control-plane-client';
import {
  deriveCockpitDataSourceStatus,
  type CockpitDataSourceStatus,
  type QueryCacheSnapshot,
} from '@/lib/cockpit-data-source-status';
import { resolveCockpitRuntime } from '@/lib/cockpit-runtime';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const TENANT_QUERY_PREFIXES = new Set([
  'adapters',
  'approval-thresholds',
  'approvals',
  'evidence',
  'estop-log',
  'estop-status',
  'gateways',
  'human-tasks',
  'missions',
  'robot-locations',
  'robots',
  'runs',
  'safety-constraints',
  'work-items',
  'workforce-members',
  'workforce-queues',
]);

function queryBelongsToWorkspace(queryKey: readonly unknown[], workspaceId: string): boolean {
  const [prefix] = queryKey;
  return (
    typeof prefix === 'string' &&
    TENANT_QUERY_PREFIXES.has(prefix) &&
    queryKey.includes(workspaceId)
  );
}

function summarizeWorkspaceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
): QueryCacheSnapshot {
  const queries = queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => queryBelongsToWorkspace(query.queryKey, workspaceId) });

  let hasData = false;
  let hasError = false;
  let hasUnauthorizedError = false;
  let isFetching = false;
  let latestUpdatedAtMs: number | undefined;

  for (const query of queries) {
    const state = query.state;
    hasData ||= state.data !== undefined;
    hasError ||= state.status === 'error';
    isFetching ||= state.fetchStatus === 'fetching';
    if (state.error instanceof CockpitApiError && [401, 403].includes(state.error.status)) {
      hasUnauthorizedError = true;
    }
    if (state.dataUpdatedAt > 0) {
      latestUpdatedAtMs = Math.max(latestUpdatedAtMs ?? 0, state.dataUpdatedAt);
    }
  }

  return {
    hasQueries: queries.length > 0,
    hasData,
    hasError,
    hasUnauthorizedError,
    isFetching,
    latestUpdatedAtMs,
  };
}

export function useCockpitDataSourceStatus(): CockpitDataSourceStatus & {
  readonly pendingOutboxCount: number;
  readonly refresh: () => void;
} {
  const queryClient = useQueryClient();
  const workspaceId = useUIStore((state) => state.activeWorkspaceId);
  const authStatus = useAuthStore((state) => state.status);
  const { isOnline, pendingCount } = useOfflineQueue();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      window.setTimeout(() => {
        if (!disposed) setVersion((current) => current + 1);
      }, 0);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => setVersion((current) => current + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const status = useMemo(
    () =>
      deriveCockpitDataSourceStatus({
        runtime: resolveCockpitRuntime(),
        authStatus,
        workspaceId,
        isOnline,
        snapshot: summarizeWorkspaceQueries(queryClient, workspaceId),
      }),
    [authStatus, isOnline, queryClient, version, workspaceId],
  );

  return {
    ...status,
    pendingOutboxCount: pendingCount,
    refresh: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => queryBelongsToWorkspace(query.queryKey, workspaceId),
      });
    },
  };
}
