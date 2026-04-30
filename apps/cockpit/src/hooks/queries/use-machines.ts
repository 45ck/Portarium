import { useQuery } from '@tanstack/react-query';
import type { AgentCapability, MachineV1 } from '@portarium/cockpit-types';

type MachineRegistration = Readonly<{
  schemaVersion: 1;
  machineId: string;
  workspaceId: string;
  hostname?: string;
  displayName?: string;
  endpointUrl?: string;
  active?: boolean;
  registeredAtIso: string;
  status?: MachineV1['status'];
  allowedCapabilities?: MachineV1['allowedCapabilities'];
  capabilities?: readonly { capability: string }[];
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

function toMachineView(machine: MachineRegistration): MachineV1 {
  if (machine.hostname && machine.status) return machine as MachineV1;
  return {
    schemaVersion: 1,
    machineId: machine.machineId,
    workspaceId: machine.workspaceId,
    hostname: machine.displayName ?? machine.hostname ?? machine.machineId,
    registeredAtIso: machine.registeredAtIso,
    status: machine.active === false ? 'Offline' : 'Online',
    activeRunCount: 0,
    allowedCapabilities:
      machine.allowedCapabilities ??
      machine.capabilities?.map((capability) => toUiCapability(capability.capability)) ??
      [],
  };
}

async function fetchMachines(wsId: string): Promise<{ items: MachineV1[] }> {
  const res = await fetch(`/v1/workspaces/${encodeURIComponent(wsId)}/machines`);
  if (!res.ok) throw new Error('Failed to fetch machines');
  const body = (await res.json()) as { items: MachineRegistration[] };
  return { ...body, items: body.items.map(toMachineView) };
}

async function fetchMachine(wsId: string, machineId: string): Promise<MachineV1> {
  const res = await fetch(
    `/v1/workspaces/${encodeURIComponent(wsId)}/machines/${encodeURIComponent(machineId)}`,
  );
  if (!res.ok) throw new Error('Failed to fetch machine');
  return toMachineView((await res.json()) as MachineRegistration);
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
