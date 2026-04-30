import { useQuery } from '@tanstack/react-query';
import type { AgentCapability, AgentV1 } from '@portarium/cockpit-types';
import { fetchJson } from '@/lib/fetch-json';

type AgentConfig = Readonly<{
  schemaVersion: 1;
  agentId: string;
  workspaceId: string;
  name?: string;
  displayName?: string;
  endpoint?: string;
  machineId?: string;
  modelId?: string;
  policyTier?: AgentV1['policyTier'];
  allowedCapabilities?: AgentV1['allowedCapabilities'];
  capabilities?: readonly { capability: string }[];
  usedByWorkflowIds?: string[];
}>;

const UI_CAPABILITIES = new Set<AgentCapability>([
  'read:external',
  'write:external',
  'classify',
  'generate',
  'analyze',
  'execute-code',
  'notify',
  'machine:invoke',
]);

const DOMAIN_TO_UI_CAPABILITY: Readonly<Record<string, AgentCapability>> = {
  'agent:classify': 'classify',
  'agent:generate': 'generate',
  'agent:analyze': 'analyze',
  'code:execute': 'execute-code',
  'notification:send': 'notify',
};

function toUiCapability(capability: string): AgentCapability {
  if (UI_CAPABILITIES.has(capability as AgentCapability)) return capability as AgentCapability;
  return DOMAIN_TO_UI_CAPABILITY[capability] ?? 'analyze';
}

function toAgentView(agent: AgentConfig): AgentV1 {
  if (agent.name && agent.endpoint) return agent as AgentV1;
  return {
    schemaVersion: 1,
    agentId: agent.agentId,
    workspaceId: agent.workspaceId,
    name: agent.displayName ?? agent.name ?? agent.agentId,
    endpoint:
      agent.endpoint ?? (agent.machineId ? `machine://${agent.machineId}` : 'machine://unbound'),
    allowedCapabilities:
      agent.allowedCapabilities ??
      agent.capabilities?.map((capability) => toUiCapability(capability.capability)) ??
      [],
    usedByWorkflowIds: agent.usedByWorkflowIds ?? [],
    ...(agent.machineId ? { machineId: agent.machineId } : {}),
    ...(agent.policyTier ? { policyTier: agent.policyTier } : {}),
    ...(agent.modelId ? { modelId: agent.modelId } : {}),
  };
}

async function fetchAgents(wsId: string): Promise<{ items: AgentV1[] }> {
  const body = await fetchJson<{ items: AgentConfig[] }>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/agents`,
    undefined,
    'Failed to fetch agents',
  );
  return { ...body, items: body.items.map(toAgentView) };
}

async function fetchAgent(wsId: string, agentId: string): Promise<AgentV1> {
  const agent = await fetchJson<AgentConfig>(
    `/v1/workspaces/${encodeURIComponent(wsId)}/agents/${encodeURIComponent(agentId)}`,
    undefined,
    'Failed to fetch agent',
  );
  return toAgentView(agent);
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
