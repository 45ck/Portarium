import { describe, expect, it, vi } from 'vitest';

import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import {
  parseAgentConfigV1,
  parseMachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';
import type { Page } from '../common/query.js';
import type { MachineQueryStore } from '../ports/index.js';
import { getAgent, getMachine, listAgents, listMachines } from './machine-agent-registry.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1' as ReturnType<
  typeof import('../../domain/primitives/index.js').TenantId
>;
const WORKSPACE_ID = 'ws-1';

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
    principalId: 'user-1' as ReturnType<typeof import('../../domain/primitives/index.js').UserId>,
    correlationId: 'corr-1' as ReturnType<
      typeof import('../../domain/primitives/index.js').CorrelationId
    >,
    roles: [] as readonly never[],
    scopes: [] as readonly string[],
  };
}

function allowedAuth() {
  return { isAllowed: vi.fn().mockResolvedValue(true) };
}

function deniedAuth() {
  return { isAllowed: vi.fn().mockResolvedValue(false) };
}

function makeMachineQueryStore(overrides: Partial<MachineQueryStore> = {}): MachineQueryStore {
  return {
    getMachineRegistrationById: vi.fn().mockResolvedValue(MACHINE),
    listMachineRegistrations: vi
      .fn()
      .mockResolvedValue({ items: [MACHINE] } as Page<MachineRegistrationV1>),
    getAgentConfigById: vi.fn().mockResolvedValue(AGENT),
    listAgentConfigs: vi.fn().mockResolvedValue({ items: [AGENT] } as Page<AgentConfigV1>),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getMachine
// ---------------------------------------------------------------------------

describe('getMachine', () => {
  it('returns the machine when found', async () => {
    const result = await getMachine(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(String(result.value.machineId)).toBe('machine-1');
  });

  it('returns NotFound when machine is absent', async () => {
    const result = await getMachine(
      {
        authorization: allowedAuth(),
        machineQueryStore: makeMachineQueryStore({
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
        }),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'missing' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await getMachine(
      { authorization: deniedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: 'machine-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns ValidationFailed for empty machineId', async () => {
    const result = await getMachine(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, machineId: '' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('ValidationFailed');
  });
});

// ---------------------------------------------------------------------------
// listMachines
// ---------------------------------------------------------------------------

describe('listMachines', () => {
  it('returns page of machines', async () => {
    const result = await listMachines(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.items).toHaveLength(1);
  });

  it('passes active filter through', async () => {
    const store = makeMachineQueryStore();
    await listMachines({ authorization: allowedAuth(), machineQueryStore: store }, makeCtx(), {
      workspaceId: WORKSPACE_ID,
      active: false,
    });
    expect(store.listMachineRegistrations).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ active: false }),
    );
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await listMachines(
      { authorization: deniedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });
});

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('returns the agent when found', async () => {
    const result = await getAgent(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(String(result.value.agentId)).toBe('agent-1');
  });

  it('returns NotFound when agent is absent', async () => {
    const result = await getAgent(
      {
        authorization: allowedAuth(),
        machineQueryStore: makeMachineQueryStore({
          getAgentConfigById: vi.fn().mockResolvedValue(null),
        }),
      },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'missing' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('NotFound');
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await getAgent(
      { authorization: deniedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: 'agent-1' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns ValidationFailed for empty agentId', async () => {
    const result = await getAgent(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID, agentId: '' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('ValidationFailed');
  });
});

// ---------------------------------------------------------------------------
// listAgents
// ---------------------------------------------------------------------------

describe('listAgents', () => {
  it('returns page of agents', async () => {
    const result = await listAgents(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.items).toHaveLength(1);
  });

  it('passes machineId filter through', async () => {
    const store = makeMachineQueryStore();
    await listAgents({ authorization: allowedAuth(), machineQueryStore: store }, makeCtx(), {
      workspaceId: WORKSPACE_ID,
      machineId: 'machine-1',
    });
    expect(store.listAgentConfigs).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ machineId: expect.any(String) }),
    );
  });

  it('returns Forbidden when not authorized', async () => {
    const result = await listAgents(
      { authorization: deniedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: WORKSPACE_ID },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('Forbidden');
  });

  it('returns ValidationFailed for invalid workspaceId', async () => {
    const result = await listAgents(
      { authorization: allowedAuth(), machineQueryStore: makeMachineQueryStore() },
      makeCtx(),
      { workspaceId: '' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected err');
    expect(result.error.kind).toBe('ValidationFailed');
  });
});
