import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MissionSummary } from '@/types/robotics';

async function fetchMissions(wsId: string): Promise<{ items: MissionSummary[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/missions`);
  if (!res.ok) throw new Error('Failed to fetch missions');
  return res.json();
}

async function fetchMission(wsId: string, missionId: string): Promise<MissionSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/missions/${missionId}`);
  if (!res.ok) throw new Error('Mission not found');
  return res.json();
}

async function postMissionAction(
  wsId: string,
  missionId: string,
  action: 'cancel' | 'preempt' | 'retry',
): Promise<MissionSummary> {
  const res = await fetch(`/v1/workspaces/${wsId}/robotics/missions/${missionId}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Failed to ${action} mission`);
  return res.json();
}

export function useMissions(wsId: string) {
  return useQuery({
    queryKey: ['missions', wsId],
    queryFn: () => fetchMissions(wsId),
    enabled: Boolean(wsId),
  });
}

export function useMission(wsId: string, missionId: string) {
  return useQuery({
    queryKey: ['missions', wsId, missionId],
    queryFn: () => fetchMission(wsId, missionId),
    enabled: Boolean(wsId) && Boolean(missionId),
  });
}

function useMissionAction(wsId: string, action: 'cancel' | 'preempt' | 'retry') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (missionId: string) => postMissionAction(wsId, missionId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['missions', wsId] });
    },
  });
}

export function useCancelMission(wsId: string) {
  return useMissionAction(wsId, 'cancel');
}

export function usePreemptMission(wsId: string) {
  return useMissionAction(wsId, 'preempt');
}

export function useRetryMission(wsId: string) {
  return useMissionAction(wsId, 'retry');
}
