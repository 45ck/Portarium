import { useQuery } from '@tanstack/react-query';
import type { MachineV1 } from '@portarium/cockpit-types';

async function fetchMachines(wsId: string): Promise<{ items: MachineV1[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/machines`);
  if (!res.ok) throw new Error('Failed to fetch machines');
  return res.json() as Promise<{ items: MachineV1[] }>;
}

async function fetchMachine(wsId: string, machineId: string): Promise<MachineV1> {
  const res = await fetch(`/v1/workspaces/${wsId}/machines/${machineId}`);
  if (!res.ok) throw new Error('Failed to fetch machine');
  return res.json() as Promise<MachineV1>;
}

export function useMachines(wsId: string) {
  return useQuery({
    queryKey: ['machines', wsId],
    queryFn: () => fetchMachines(wsId),
    enabled: Boolean(wsId),
  });
}

export function useMachine(wsId: string, machineId: string) {
  return useQuery({
    queryKey: ['machines', wsId, machineId],
    queryFn: () => fetchMachine(wsId, machineId),
    enabled: Boolean(wsId) && Boolean(machineId),
  });
}
