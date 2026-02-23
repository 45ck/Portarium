import { describe, expect, it, vi } from 'vitest';

import { parseMachineRegistrationV1 } from '../../domain/machines/machine-registration-v1.js';
import type { OpenClawManagementBridgePort } from '../ports/index.js';
import type { MachineRegistryStore } from '../ports/machine-registry-store.js';
import { deactivateMachine } from './deactivate-machine.js';

const TENANT_ID = 'tenant-1' as any;
const WORKSPACE_ID = 'tenant-1';

const ACTIVE_MACHINE = parseMachineRegistrationV1({
  schemaVersion: 1,
  machineId: 'machine-1',
  workspaceId: WORKSPACE_ID,
  endpointUrl: 'https://openclaw.example.com/v1',
  active: true,
  displayName: 'Active Runner',
  capabilities: ['run:workflow'],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://gateway.example.com'],
    workloadIdentity: 'Required',
  },
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-1' },
});

const INACTIVE_MACHINE = parseMachineRegistrationV1({
  ...ACTIVE_MACHINE,
  active: false,
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

function makeBridge(): OpenClawManagementBridgePort {
  return {
    syncAgentRegistration: vi.fn().mockResolvedValue({ ok: true }),
    deregisterAgent: vi.fn().mockResolvedValue({ ok: true }),
    getAgentGatewayStatus: vi.fn().mockResolvedValue('registered'),
  };
}

function makeStore(machine = ACTIVE_MACHINE): MachineRegistryStore {
  return {
    getMachineRegistrationById: vi.fn().mockResolvedValue(machine),
    saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
    getAgentConfigById: vi.fn().mockResolvedValue(null),
    saveAgentConfig: vi.fn().mockResolvedValue(undefined),
    updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
    updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
  };
}

describe('deactivateMachine', () => {
  it('marks active machine as inactive and persists', async () => {
    const store = makeStore();
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: store,
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(String(result.value.machineId)).toBe('machine-1');
    // Should save inactive machine
    expect(store.saveMachineRegistration).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ active: false }),
    );
  });

  it('is idempotent: already-inactive machine returns success without saving', async () => {
    const store = makeStore(INACTIVE_MACHINE);
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: store,
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(true);
    expect(store.saveMachineRegistration).not.toHaveBeenCalled();
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(false) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns Forbidden on tenant mismatch (workspace isolation invariant)', async () => {
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(), // tenantId: 'tenant-1'
      { workspaceId: 'tenant-2', machineId: 'machine-1' }, // different workspace
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
    expect(result.error.message).toContain('Tenant mismatch');
  });

  it('returns NotFound when machine does not exist', async () => {
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(null as any),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'missing' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns ValidationFailed for empty machineId', async () => {
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: makeStore(),
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: '' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('ValidationFailed');
  });

  it('returns DependencyFailure when store save fails', async () => {
    const store = makeStore();
    (store.saveMachineRegistration as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('DB error'),
    );
    const result = await deactivateMachine(
      {
        authorization: { isAllowed: vi.fn().mockResolvedValue(true) },
        machineRegistryStore: store,
        bridge: makeBridge(),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('DependencyFailure');
  });
});
