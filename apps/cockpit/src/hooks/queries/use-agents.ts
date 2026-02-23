import { useQuery } from '@tanstack/react-query';
import type { AgentV1 } from '@portarium/cockpit-types';

async function fetchAgents(wsId: string): Promise<{ items: AgentV1[] }> {
  const res = await fetch(`/v1/workspaces/${wsId}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json() as Promise<{ items: AgentV1[] }>;
}

async function fetchAgent(wsId: string, agentId: string): Promise<AgentV1> {
  const res = await fetch(`/v1/workspaces/${wsId}/agents/${agentId}`);
  if (!res.ok) throw new Error('Failed to fetch agent');
  return res.json() as Promise<AgentV1>;
}

export function useAgents(wsId: string) {
  return useQuery({
    queryKey: ['agents', wsId],
    queryFn: () => fetchAgents(wsId),
    enabled: Boolean(wsId),
  });
}

export function useAgent(wsId: string, agentId: string) {
  return useQuery({
    queryKey: ['agents', wsId, agentId],
    queryFn: () => fetchAgent(wsId, agentId),
    enabled: Boolean(wsId) && Boolean(agentId),
  });
}
