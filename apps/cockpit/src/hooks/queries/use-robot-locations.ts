import type { RobotLocation, Geofence, SpatialAlert } from '@/types/robotics';
import { fetchJson } from '@/lib/fetch-json';
import { useOfflineQuery } from '@/hooks/queries/use-offline-query';

interface RobotLocationsResponse {
  items: RobotLocation[];
  geofences: Geofence[];
  alerts: SpatialAlert[];
}

async function fetchRobotLocations(wsId: string): Promise<RobotLocationsResponse> {
  return fetchJson(
    `/v1/workspaces/${wsId}/robotics/robot-locations`,
    undefined,
    'Failed to fetch robot locations',
  );
}

export function useRobotLocations(wsId: string) {
  return useOfflineQuery({
    queryKey: ['robot-locations', wsId],
    cacheKey: `robot-locations:${wsId}`,
    queryFn: () => fetchRobotLocations(wsId),
    refetchInterval: 5000,
    enabled: Boolean(wsId),
  });
}
