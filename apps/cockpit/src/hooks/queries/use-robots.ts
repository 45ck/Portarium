import { useQuery } from '@tanstack/react-query'
import type { RobotSummary } from '@/types/robotics'

async function fetchRobots(wsId: string): Promise<{ items: RobotSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/robots`)
  if (!res.ok) throw new Error('Failed to fetch robots')
  return res.json()
}

async function fetchRobot(wsId: string, robotId: string): Promise<RobotSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/robots/${robotId}`)
  if (!res.ok) throw new Error('Robot not found')
  return res.json()
}

export function useRobots(wsId: string) {
  return useQuery({ queryKey: ['robots', wsId], queryFn: () => fetchRobots(wsId) })
}

export function useRobot(wsId: string, robotId: string) {
  return useQuery({ queryKey: ['robots', wsId, robotId], queryFn: () => fetchRobot(wsId, robotId) })
}
