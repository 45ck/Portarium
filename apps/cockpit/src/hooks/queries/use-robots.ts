import type { RobotSummary } from '@/types/robotics';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';
import { shouldEnableRoboticsQuery } from '@/lib/robotics-runtime';

interface RoboticsQueryOptions {
  enabled?: boolean;
}

async function fetchRobots(wsId: string): Promise<{ items: RobotSummary[] }> {
  return fetchJson(`/v1/workspaces/${wsId}/robotics/robots`, undefined, 'Failed to fetch robots');
}

async function fetchRobot(wsId: string, robotId: string): Promise<RobotSummary> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/robots/${robotId}`,
    undefined,
    'Robot not found',
  );
}

export function useRobots(wsId: string, options: RoboticsQueryOptions = {}) {
  return useOfflineQuery({
    queryKey: ['robots', wsId],
    cacheKey: `robots:${wsId}`,
    queryFn: () => fetchRobots(wsId),
    enabled: shouldEnableRoboticsQuery(wsId, options.enabled),
  });
}

export function useRobot(wsId: string, robotId: string, options: RoboticsQueryOptions = {}) {
  return useOfflineQuery({
    queryKey: ['robots', wsId, robotId],
    cacheKey: `robots:${wsId}:${robotId}`,
    queryFn: () => fetchRobot(wsId, robotId),
    enabled: shouldEnableRoboticsQuery(wsId, options.enabled) && Boolean(robotId),
  });
}
