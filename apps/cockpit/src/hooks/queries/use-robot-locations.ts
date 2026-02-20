import { useQuery } from '@tanstack/react-query'
import type { RobotLocation, Geofence, SpatialAlert } from '@/mocks/fixtures/robot-locations'

interface RobotLocationsResponse {
  items: RobotLocation[]
  geofences: Geofence[]
  alerts: SpatialAlert[]
}

async function fetchRobotLocations(wsId: string): Promise<RobotLocationsResponse> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/robot-locations`)
  if (!res.ok) throw new Error('Failed to fetch robot locations')
  return res.json()
}

export function useRobotLocations(wsId: string) {
  return useQuery({
    queryKey: ['robot-locations', wsId],
    queryFn: () => fetchRobotLocations(wsId),
    refetchInterval: 5000,
  })
}
