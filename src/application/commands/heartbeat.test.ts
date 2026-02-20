import { describe, expect, it, vi } from 'vitest';

import { processAgentHeartbeat, processMachineHeartbeat } from './heartbeat.js';
import type {
  AuthorizationPort,
  Clock,
  HeartbeatData,
  MachineRegistryStore,
} from '../ports/index.js';
import { toAppContext } from '../common/context.js';

function makeCtx(workspaceId = 'ws-1') {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-1',
    correlationId: 'corr-1',
    roles: ['operator'],
  });
}

function createDeps(overrides?: { allowed?: boolean }) {
  const machineHeartbeats = new Map<string, HeartbeatData>();
  const agentHeartbeats = new Map<string, HeartbeatData>();

  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => overrides?.allowed ?? true),
  };
  const clock: Clock = {
    nowIso: vi.fn(() => '2026-02-21T10:00:00.000Z'),
  };

  const machineRegistryStore: MachineRegistryStore = {
    getMachineRegistrationById: vi.fn(async () => null),
    saveMachineRegistration: vi.fn(async () => {}),
    getAgentConfigById: vi.fn(async () => null),
    saveAgentConfig: vi.fn(async () => {}),
    updateMachineHeartbeat: vi.fn(async (_tenantId, machineId, heartbeat) => {
      const key = String(machineId);
      if (key === 'machine-missing') return false;
      machineHeartbeats.set(key, heartbeat);
      return true;
    }),
    updateAgentHeartbeat: vi.fn(async (_tenantId, agentId, heartbeat) => {
      const key = String(agentId);
      if (key === 'agent-missing') return false;
      agentHeartbeats.set(key, heartbeat);
      return true;
    }),
  };

  return {
    deps: { authorization, clock, machineRegistryStore },
    machineHeartbeats,
    agentHeartbeats,
  };
}

describe('heartbeat commands', () => {
  describe('processMachineHeartbeat', () => {
    it('updates machine heartbeat and returns timestamp', async () => {
      const { deps, machineHeartbeats } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'ok',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.lastHeartbeatAtIso).toBe('2026-02-21T10:00:00.000Z');
      expect(machineHeartbeats.get('machine-1')).toEqual({
        status: 'ok',
        lastHeartbeatAtIso: '2026-02-21T10:00:00.000Z',
      });
    });

    it('accepts degraded status with metrics and location', async () => {
      const { deps, machineHeartbeats } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'degraded',
        metrics: { cpu: 85.5, memoryMb: 1024 },
        location: { lat: 52.52, lon: 13.405 },
      });

      expect(result.ok).toBe(true);
      const stored = machineHeartbeats.get('machine-1');
      expect(stored?.status).toBe('degraded');
      expect(stored?.metrics).toEqual({ cpu: 85.5, memoryMb: 1024 });
      expect(stored?.location).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('returns NotFound when machine does not exist', async () => {
      const { deps } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-missing',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('NotFound');
    });

    it('enforces tenant match', async () => {
      const { deps } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-2'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('Forbidden');
    });

    it('rejects invalid status', async () => {
      const { deps } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'invalid',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('ValidationFailed');
      expect(result.error.message).toContain('status');
    });

    it('rejects empty machineId', async () => {
      const { deps } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: '',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('ValidationFailed');
    });

    it('rejects out-of-range latitude', async () => {
      const { deps } = createDeps();
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'ok',
        location: { lat: 91, lon: 0 },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('ValidationFailed');
      expect(result.error.message).toContain('lat');
    });

    it('denies when authorization fails', async () => {
      const { deps } = createDeps({ allowed: false });
      const result = await processMachineHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        machineId: 'machine-1',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('Forbidden');
    });
  });

  describe('processAgentHeartbeat', () => {
    it('updates agent heartbeat and returns timestamp', async () => {
      const { deps, agentHeartbeats } = createDeps();
      const result = await processAgentHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        agentId: 'agent-1',
        status: 'ok',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.lastHeartbeatAtIso).toBe('2026-02-21T10:00:00.000Z');
      expect(agentHeartbeats.get('agent-1')).toEqual({
        status: 'ok',
        lastHeartbeatAtIso: '2026-02-21T10:00:00.000Z',
      });
    });

    it('returns NotFound when agent does not exist', async () => {
      const { deps } = createDeps();
      const result = await processAgentHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        agentId: 'agent-missing',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('NotFound');
    });

    it('rejects empty agentId', async () => {
      const { deps } = createDeps();
      const result = await processAgentHeartbeat(deps, makeCtx('ws-1'), {
        workspaceId: 'ws-1',
        agentId: '',
        status: 'ok',
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('ValidationFailed');
    });
  });
});
