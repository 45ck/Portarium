import { describe, expect, it, vi } from 'vitest';

import {
  parseAgentConfigV1,
  parseMachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { BridgeOperationResult, OpenClawManagementBridgePort } from '../ports/index.js';
import type { MachineRegistryStore } from '../ports/machine-registry-store.js';
import { syncAgentToGateway } from './sync-agent-to-gateway.js';

const TENANT_ID = 'tenant-1' as any;
const WORKSPACE_ID = 'tenant-1';

const MACHINE = parseMachineRegistrationV1({
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: WORKSPACE_ID,
  endpointUrl: 'https://openclaw.example.com/v1',
  active: true,
  displayName: 'Runner',
  capabilities: ['run:workflow'],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://gateway.example.com'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
});

const AGENT = parseAgentConfigV1({
  schemaVersion: 1,
  agentId: 'agent-1',
  workspaceId: WORKSPACE_ID,
  machineId: 'machine-1',
  displayName: 'Classifier',
  capabilities: ['run:workflow'],
  policyTier: 'Auto',
  allowedTools: ['read:external'],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
});

function makeCtx() {
  return {
    tenantId: TENANT_ID,
    principalId: 'user-1' as any,
    correlationId: 'corr-1' as any,
    roles: [] as readonly never[],
    scopes: [] as readonly string[],
  };
}

function makeBridge(result: BridgeOperationResult = { ok: true }): OpenClawManagementBridgePort {
  return {
    syncAgentRegistration: vi.fn().mockResolvedValue(result),
    deregisterAgent: vi.fn().mockResolvedValue({ ok: true }),
    getAgentGatewayStatus: vi.fn().mockResolvedValue('registered'),
  };
}

function makeStore(overrides: Partial<MachineRegistryStore> = {}): MachineRegistryStore {
  return {
    getMachineRegistrationById: vi.fn().mockResolvedValue(MACHINE),
    saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
    getAgentConfigById: vi.fn().mockResolvedValue(AGENT),
    saveAgentConfig: vi.fn().mockResolvedValue(undefined),
    updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
    updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('syncAgentToGateway', () => {
  it('returns ok with gatewayAcknowledged true when bridge confirms', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge({ ok: true }),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.gatewayAcknowledged).toBe(true);
    expect(String(result.value.agentId)).toBe('agent-1');
  });

  it('returns ok with gatewayAcknowledged false when bridge fails (soft failure)', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge({ ok: false, reason: 'gateway timeout' }),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.gatewayAcknowledged).toBe(false);
    expect(result.value.gatewayDetail).toBe('gateway timeout');
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(false) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns Forbidden on tenant mismatch (workspace isolation invariant)', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(), // tenantId: 'tenant-1'
      { workspaceId: 'tenant-2', agentId: 'agent-1' }, // different workspace
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toContain('Tenant mismatch');
  });

  it('returns NotFound when agent does not exist', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore({ getAgentConfigById: vi.fn().mockResolvedValue(null) }),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'missing' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns NotFound when machine does not exist', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore({
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
        }),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns ValidationFailed for empty agentId', async () => {
    const result = await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: '' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('calls bridge with correct capabilities', async () => {
    const bridge = makeBridge();
    await syncAgentToGateway(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge,
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(bridge.syncAgentRegistration).toHaveBeenCalledWith(
      TENANT_ID,
      MACHINE.machineId,
      AGENT.agentId,
      expect.arrayContaining(['run:workflow']),
    );
  });
});
