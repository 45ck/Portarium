import { describe, expect, it, vi } from 'vitest';

import type { OpenClawManagementBridgePort } from '../../application/ports/openclaw-management-bridge-port.js';
import type { MachineQueryStore } from '../../application/ports/machine-query-store.js';
import type { AgentConfigV1 } from '../../domain/machines/machine-registration-v1.js';
import type { AgentId, MachineId, TenantId, WorkspaceId } from '../../domain/primitives/index.js';
import { OpenClawDriftSyncPipeline } from './openclaw-drift-sync-pipeline.js';

const TENANT_ID = 'tenant-1' as TenantId;
const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const FIXED_NOW = 1_700_000_000_000;

function makeAgent(id: string, machineId = 'machine-1'): AgentConfigV1 {
  return {
    agentId: id as AgentId,
    machineId: machineId as MachineId,
    workspaceId: WORKSPACE_ID,
    displayName: id,
    capabilities: ['run:workflow'],
    policyTier: 'Auto',
    allowedTools: [],
    registeredAt: new Date(FIXED_NOW),
  } as unknown as AgentConfigV1;
}

function makeQueryStore(agents: AgentConfigV1[]): MachineQueryStore {
  return {
    getMachineRegistrationById: vi.fn(),
    listMachineRegistrations: vi.fn(),
    getAgentConfigById: vi.fn(),
    listAgentConfigs: vi
      .fn()
      .mockResolvedValue({ items: agents, total: agents.length, cursor: undefined }),
  } as unknown as MachineQueryStore;
}

function makeBridge(
  overrides: Partial<OpenClawManagementBridgePort> = {},
): OpenClawManagementBridgePort {
  return {
    getAgentGatewayStatus: vi.fn().mockResolvedValue('registered'),
    syncAgentRegistration: vi.fn().mockResolvedValue({ ok: true }),
    deregisterAgent: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function makePipeline(store: MachineQueryStore, bridge: OpenClawManagementBridgePort) {
  return new OpenClawDriftSyncPipeline(store, bridge, { now: () => FIXED_NOW });
}

describe('OpenClawDriftSyncPipeline.syncWorkspace', () => {
  it('returns zero drift when all agents are registered', async () => {
    const agents = [makeAgent('agent-1'), makeAgent('agent-2')];
    const store = makeQueryStore(agents);
    const bridge = makeBridge();

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(2);
    expect(report.driftDetected).toBe(0);
    expect(report.synced).toBe(0);
    expect(report.syncFailures).toBe(0);
    expect(bridge.syncAgentRegistration).not.toHaveBeenCalled();
  });

  it('detects drift and syncs unregistered agents', async () => {
    const agents = [makeAgent('agent-1'), makeAgent('agent-2')];
    const store = makeQueryStore(agents);
    const bridge = makeBridge({
      getAgentGatewayStatus: vi
        .fn()
        .mockResolvedValueOnce('registered')
        .mockResolvedValueOnce('unregistered'),
    });

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(2);
    expect(report.driftDetected).toBe(1);
    expect(report.synced).toBe(1);
    expect(report.syncFailures).toBe(0);
    expect(bridge.syncAgentRegistration).toHaveBeenCalledTimes(1);
    expect(bridge.syncAgentRegistration).toHaveBeenCalledWith(
      TENANT_ID,
      expect.anything(),
      'agent-2',
      agents[1]!.capabilities,
    );
  });

  it('counts sync failures when bridge sync fails', async () => {
    const agents = [makeAgent('agent-1')];
    const store = makeQueryStore(agents);
    const bridge = makeBridge({
      getAgentGatewayStatus: vi.fn().mockResolvedValue('unregistered'),
      syncAgentRegistration: vi.fn().mockResolvedValue({ ok: false, reason: 'gateway down' }),
    });

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.driftDetected).toBe(1);
    expect(report.synced).toBe(0);
    expect(report.syncFailures).toBe(1);
  });

  it('skips agents with unknown status (gateway unreachable)', async () => {
    const agents = [makeAgent('agent-1')];
    const store = makeQueryStore(agents);
    const bridge = makeBridge({
      getAgentGatewayStatus: vi.fn().mockResolvedValue('unknown'),
    });

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(1);
    expect(report.driftDetected).toBe(0);
    expect(bridge.syncAgentRegistration).not.toHaveBeenCalled();
  });

  it('returns zero-count report when query store is empty', async () => {
    const store = makeQueryStore([]);
    const bridge = makeBridge();

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(0);
    expect(report.driftDetected).toBe(0);
    expect(bridge.getAgentGatewayStatus).not.toHaveBeenCalled();
  });

  it('returns empty report when query store throws (soft failure)', async () => {
    const store = makeQueryStore([]);
    (store.listAgentConfigs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
    const bridge = makeBridge();

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(0);
    expect(bridge.getAgentGatewayStatus).not.toHaveBeenCalled();
  });

  it('includes correct metadata in report', async () => {
    const store = makeQueryStore([]);
    const bridge = makeBridge();

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.tenantId).toBe('tenant-1');
    expect(report.workspaceId).toBe('ws-1');
    expect(report.completedAtIso).toBe(new Date(FIXED_NOW).toISOString());
  });

  it('respects maxAgentsPerPass limit', async () => {
    const agents = Array.from({ length: 5 }, (_, i) => makeAgent(`agent-${i}`));
    const store = makeQueryStore(agents);
    const bridge = makeBridge();
    const pipeline = new OpenClawDriftSyncPipeline(store, bridge, {
      maxAgentsPerPass: 3,
      now: () => FIXED_NOW,
    });

    await pipeline.syncWorkspace(TENANT_ID, WORKSPACE_ID);

    // The store was called with limit: 3
    expect(store.listAgentConfigs).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ pagination: { limit: 3 } }),
    );
  });

  it('handles multiple agents all drifted and all successfully re-synced', async () => {
    const agents = [makeAgent('a1'), makeAgent('a2'), makeAgent('a3')];
    const store = makeQueryStore(agents);
    const bridge = makeBridge({
      getAgentGatewayStatus: vi.fn().mockResolvedValue('unregistered'),
    });

    const report = await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(report.agentsChecked).toBe(3);
    expect(report.driftDetected).toBe(3);
    expect(report.synced).toBe(3);
    expect(report.syncFailures).toBe(0);
  });

  it('passes agent capabilities to syncAgentRegistration', async () => {
    const agent = {
      ...makeAgent('cap-agent'),
      capabilities: ['read:file', 'write:db'],
    } as unknown as AgentConfigV1;
    const store = makeQueryStore([agent]);
    const bridge = makeBridge({
      getAgentGatewayStatus: vi.fn().mockResolvedValue('unregistered'),
    });

    await makePipeline(store, bridge).syncWorkspace(TENANT_ID, WORKSPACE_ID);

    expect(bridge.syncAgentRegistration).toHaveBeenCalledWith(
      TENANT_ID,
      agent.machineId,
      agent.agentId,
      ['read:file', 'write:db'],
    );
  });
});
