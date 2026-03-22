import { describe, expect, it } from 'vitest';

import { AgentId, MachineId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  parseMachineRegistrationV1,
  parseAgentConfigV1,
} from '../../domain/machines/machine-registration-v1.js';
import { InMemoryMachineRegistryStore } from './in-memory-machine-registry-store.js';

const T = TenantId('t-1');
const WS = WorkspaceId('ws-1');

function makeMachine(id: string, active = true) {
  return parseMachineRegistrationV1({
    schemaVersion: 1,
    machineId: id,
    workspaceId: 'ws-1',
    endpointUrl: `https://${id}.localhost:3000`,
    active,
    displayName: `Machine ${id}`,
    capabilities: [{ capability: 'Execution:RunAgent' }],
    registeredAtIso: '2026-01-01T00:00:00Z',
    executionPolicy: {
      isolationMode: 'PerTenantWorker',
      egressAllowlist: [`https://${id}.localhost:3000`],
      workloadIdentity: 'Required',
    },
    ...(active ? { authConfig: { kind: 'bearer', secretRef: `${id}/token` } } : {}),
  });
}

function makeAgent(id: string, machineId: string) {
  return parseAgentConfigV1({
    schemaVersion: 1,
    agentId: id,
    workspaceId: 'ws-1',
    machineId,
    displayName: `Agent ${id}`,
    capabilities: [{ capability: 'Execution:RunAgent' }],
    policyTier: 'HumanApprove',
    allowedTools: ['file_read'],
    registeredAtIso: '2026-01-01T00:00:00Z',
  });
}

describe('InMemoryMachineRegistryStore', () => {
  describe('MachineRegistryStore (write)', () => {
    it('saves and retrieves a machine by 2-arg signature', async () => {
      const store = new InMemoryMachineRegistryStore();
      const machine = makeMachine('m-1');
      await store.saveMachineRegistration(T, machine);
      const found = await store.getMachineRegistrationById(T, MachineId('m-1'));
      expect(found).not.toBeNull();
      expect(found!.machineId).toBe('m-1');
    });

    it('returns null for unknown machine', async () => {
      const store = new InMemoryMachineRegistryStore();
      expect(await store.getMachineRegistrationById(T, MachineId('nope'))).toBeNull();
    });

    it('saves and retrieves an agent', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveAgentConfig(T, makeAgent('a-1', 'm-1'));
      const found = await store.getAgentConfigById(T, AgentId('a-1'));
      expect(found).not.toBeNull();
      expect(found!.agentId).toBe('a-1');
    });

    it('heartbeat returns false for unknown machine', async () => {
      const store = new InMemoryMachineRegistryStore();
      const result = await store.updateMachineHeartbeat(T, MachineId('nope'), {
        status: 'ok',
        lastHeartbeatAtIso: '2026-01-01T00:00:00Z',
      });
      expect(result).toBe(false);
    });

    it('heartbeat returns true for known machine', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveMachineRegistration(T, makeMachine('m-1'));
      const result = await store.updateMachineHeartbeat(T, MachineId('m-1'), {
        status: 'ok',
        lastHeartbeatAtIso: '2026-01-01T00:00:00Z',
      });
      expect(result).toBe(true);
    });
  });

  describe('MachineQueryStore (read)', () => {
    it('retrieves a machine by 3-arg signature', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveMachineRegistration(T, makeMachine('m-1'));
      const found = await store.getMachineRegistrationById(T, WS, MachineId('m-1'));
      expect(found).not.toBeNull();
      expect(found!.machineId).toBe('m-1');
    });

    it('lists machines filtered by workspace', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveMachineRegistration(T, makeMachine('m-1'));
      await store.saveMachineRegistration(T, makeMachine('m-2'));
      const page = await store.listMachineRegistrations(T, {
        workspaceId: WS,
        pagination: { limit: 50 },
      });
      expect(page.items).toHaveLength(2);
    });

    it('filters machines by active status', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveMachineRegistration(T, makeMachine('m-active', true));
      await store.saveMachineRegistration(T, makeMachine('m-inactive', false));
      const page = await store.listMachineRegistrations(T, {
        workspaceId: WS,
        active: true,
        pagination: { limit: 50 },
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.machineId).toBe('m-active');
    });

    it('lists agents filtered by workspace', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveAgentConfig(T, makeAgent('a-1', 'm-1'));
      await store.saveAgentConfig(T, makeAgent('a-2', 'm-1'));
      const page = await store.listAgentConfigs(T, {
        workspaceId: WS,
        pagination: { limit: 50 },
      });
      expect(page.items).toHaveLength(2);
    });

    it('filters agents by machineId', async () => {
      const store = new InMemoryMachineRegistryStore();
      await store.saveAgentConfig(T, makeAgent('a-1', 'm-1'));
      await store.saveAgentConfig(T, makeAgent('a-2', 'm-2'));
      const page = await store.listAgentConfigs(T, {
        workspaceId: WS,
        machineId: MachineId('m-1'),
        pagination: { limit: 50 },
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.agentId).toBe('a-1');
    });
  });
});
