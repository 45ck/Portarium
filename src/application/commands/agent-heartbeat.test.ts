import { describe, expect, it, vi } from 'vitest';

import { processHeartbeat } from './agent-heartbeat.js';
import type {
  AuthorizationPort,
  Clock,
  HeartbeatData,
  MachineRegistryStore,
} from '../ports/index.js';
import { toAppContext } from '../common/context.js';
import { TenantId, AgentId, MachineId } from '../../domain/primitives/index.js';

function makeCtx(workspaceId = 'ws-1') {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-1',
    correlationId: 'corr-hb-1',
    roles: ['admin'],
  });
}

function createDeps(overrides?: { allowed?: boolean }) {
  const machineHeartbeats = new Map<string, HeartbeatData>();
  const agentHeartbeats = new Map<string, HeartbeatData>();

  const authorization: AuthorizationPort = {
    isAllowed: vi.fn(async () => overrides?.allowed ?? true),
  };
  const clock: Clock = {
    nowIso: vi.fn(() => '2026-02-21T12:00:00.000Z'),
  };

  const machineRegistryStore: MachineRegistryStore = {
    getMachineRegistrationById: vi.fn(async () => null),
    saveMachineRegistration: vi.fn(async () => undefined),
    getAgentConfigById: vi.fn(async () => null),
    saveAgentConfig: vi.fn(async () => undefined),
    updateMachineHeartbeat: vi.fn(
      async (_tenantId: ReturnType<typeof TenantId>, machineId: ReturnType<typeof MachineId>, hb: HeartbeatData) => {
        if (String(machineId) === 'machine-1') {
          machineHeartbeats.set(String(machineId), hb);
          return true;
        }
        return false;
      },
    ),
    updateAgentHeartbeat: vi.fn(
      async (_tenantId: ReturnType<typeof TenantId>, agentId: ReturnType<typeof AgentId>, hb: HeartbeatData) => {
        if (String(agentId) === 'agent-1') {
          agentHeartbeats.set(String(agentId), hb);
          return true;
        }
        return false;
      },
    ),
  };

  return {
    deps: { authorization, clock, machineRegistryStore },
    machineHeartbeats,
    agentHeartbeats,
  };
}

describe('processHeartbeat', () => {
  it('accepts a valid machine heartbeat', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      status: 'ok',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.acknowledgedAtIso).toBe('2026-02-21T12:00:00.000Z');
  });

  it('accepts a valid agent heartbeat with metrics and location', async () => {
    const { deps, agentHeartbeats } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      status: 'degraded',
      metrics: { cpuPercent: 85.5, memoryMb: 1024 },
      location: { lat: 51.5074, lon: -0.1278 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.acknowledgedAtIso).toBe('2026-02-21T12:00:00.000Z');
    const stored = agentHeartbeats.get('agent-1');
    expect(stored).toBeDefined();
    expect(stored!.status).toBe('degraded');
    expect(stored!.metrics).toEqual({ cpuPercent: 85.5, memoryMb: 1024 });
    expect(stored!.location).toEqual({ lat: 51.5074, lon: -0.1278 });
  });

  it('rejects invalid status', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      status: 'offline',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('rejects when neither agentId nor machineId provided', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      status: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationFailed');
    expect(result.error.message).toContain('agentId or machineId');
  });

  it('enforces tenant match', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-2'), {
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      status: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns NotFound for unknown machine', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      machineId: 'machine-unknown',
      status: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns NotFound for unknown agent', async () => {
    const { deps } = createDeps();
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      agentId: 'agent-unknown',
      status: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NotFound');
  });

  it('rejects when authorization denies', async () => {
    const { deps } = createDeps({ allowed: false });
    const result = await processHeartbeat(deps, makeCtx('ws-1'), {
      workspaceId: 'ws-1',
      machineId: 'machine-1',
      status: 'ok',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('Forbidden');
  });
});
