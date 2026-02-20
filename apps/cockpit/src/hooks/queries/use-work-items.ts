import { useQuery } from '@tanstack/react-query'
import type { WorkItemSummary } from '@portarium/cockpit-types'

async function fetchWorkItems(wsId: string): Promise<{ items: WorkItemSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/work-items`)
  if (!res.ok) throw new Error('Failed to fetch work items')
  return res.json()
}

async function fetchWorkItem(wsId: string, wiId: string): Promise<WorkItemSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/work-items/${wiId}`)
  if (!res.ok) throw new Error('Work item not found')
  return res.json()
}

export function useWorkItems(wsId: string) {
  return useQuery({ queryKey: ['work-items', wsId], queryFn: () => fetchWorkItems(wsId) })
}

export function useWorkItem(wsId: string, wiId: string) {
  return useQuery({ queryKey: ['work-items', wsId, wiId], queryFn: () => fetchWorkItem(wsId, wiId) })
}
