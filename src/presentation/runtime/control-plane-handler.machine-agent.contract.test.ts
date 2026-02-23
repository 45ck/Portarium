import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { ok, err } from '../../application/common/result.js';
import { toAppContext } from '../../application/common/context.js';
import { AgentId, CapabilityKey, MachineId, WorkspaceId } from '../../domain/primitives/index.js';
import type {
  AgentConfigV1,
  MachineRegistrationV1,
} from '../../domain/machines/machine-registration-v1.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeCtx(
  workspaceId: string,
  roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin'],
) {
  return toAppContext({
    tenantId: workspaceId,
    principalId: 'user-1',
    roles,
    correlationId: 'corr-machine-agent',
  });
}

function makeDeps(args?: {
  workspaceId?: string;
  roles?: readonly ('admin' | 'operator' | 'approver' | 'auditor')[];
  unauthorized?: boolean;
  allowRead?: boolean;
}) {
  const workspaceId = args?.workspaceId ?? 'workspace-1';
  const roles = args?.roles ?? ['admin'];
  const unauthorized = args?.unauthorized ?? false;
  const allowRead = args?.allowRead ?? true;

  return {
    authentication: {
      authenticateBearerToken: async () =>
        unauthorized
          ? err({ kind: 'Unauthorized' as const, message: 'Missing token.' })
          : ok(makeCtx(workspaceId, roles)),
    },
    authorization: {
      isAllowed: async () => allowRead,
    },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
  };
}

describe('createControlPlaneHandler machine/agent contract routes', () => {
  it('returns 401 Problem Details for machine heartbeat when unauthenticated', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({
          unauthorized: true,
        }),
      ),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      },
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    const body = (await res.json()) as { title: string; status: number; type: string };
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
    expect(body.type).toMatch(/unauthorized/);
  });

  it('rejects cross-workspace machine heartbeat (multi-tenant scope)', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({
          workspaceId: 'workspace-1',
          roles: ['admin'],
        }),
      ),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-2/machines/machine-ws2-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      },
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    const body = (await res.json()) as { detail: string; status: number };
    expect(body.status).toBe(403);
  });

  it('accepts a machine heartbeat and returns lastHeartbeatAtIso', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-ws1-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      lastHeartbeatAtIso: string;
      machineId: string;
      status: string;
    };
    expect(typeof body.lastHeartbeatAtIso).toBe('string');
    expect(body.lastHeartbeatAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.machineId).toBe('machine-ws1-1');
    expect(body.status).toBe('ok');
  });

  it('accepts an agent heartbeat with metrics and location', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-ws1-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'degraded',
          metrics: { cpuPercent: 85 },
          location: { lat: 51.5, lon: -0.12 },
        }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agentId: string;
      status: string;
      lastHeartbeatAtIso: string;
    };
    expect(body.agentId).toBe('agent-ws1-1');
    expect(body.status).toBe('degraded');
    expect(typeof body.lastHeartbeatAtIso).toBe('string');
  });

  it('rejects heartbeat with invalid status', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-ws1-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'offline' }),
      },
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('rejects cross-workspace heartbeat', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps({ workspaceId: 'workspace-1' })),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-2/machines/machine-ws2-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      },
    );
    expect(res.status).toBe(403);
  });

  it('returns agent work-items endpoint with items array', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-ws1-1/work-items`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; agentId: string };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.agentId).toBe('agent-ws1-1');
  });

  it('enforces cross-workspace for agent work-items', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(
        makeDeps({ workspaceId: 'workspace-1', roles: ['admin'] }),
      ),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-2/agents/agent-ws2-1/work-items`,
    );
    expect(res.status).toBe(403);
  });

  it('returns 401 for heartbeat when unauthenticated', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps({ unauthorized: true })),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-ws1-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok' }),
      },
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Registry fixtures
// ---------------------------------------------------------------------------

const machine1: MachineRegistrationV1 = {
  schemaVersion: 1,
  machineId: MachineId('machine-1'),
  workspaceId: WorkspaceId('workspace-1'),
  endpointUrl: 'https://machine.example.com',
  active: false,
  displayName: 'Test Machine',
  capabilities: [{ capability: CapabilityKey('robotics:move') }],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
  executionPolicy: {
    isolationMode: 'PerTenantWorker',
    egressAllowlist: ['https://allowed.example.com'],
    workloadIdentity: 'Required',
  },
};

/** Machine with gateway credentials configured — authConfig must be stripped before browser exposure. */
const machineWithAuthConfig: MachineRegistrationV1 = {
  ...machine1,
  machineId: MachineId('machine-with-auth'),
  authConfig: { kind: 'bearer', secretRef: 'grants/cg-secret-ref' },
};

const agent1: AgentConfigV1 = {
  schemaVersion: 1,
  agentId: AgentId('agent-1'),
  workspaceId: WorkspaceId('workspace-1'),
  machineId: MachineId('machine-1'),
  displayName: 'Test Agent',
  capabilities: [{ capability: CapabilityKey('robotics:move') }],
  policyTier: 'HumanApprove',
  allowedTools: [],
  registeredAtIso: '2026-01-01T00:00:00.000Z',
};

describe('machines/agents registry endpoints', () => {
  it('returns 401 for GET /machines when unauthenticated', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ unauthorized: true }),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 503 when machineQueryStore not configured', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
    );
    expect(res.status).toBe(503);
  });

  it('lists machines returning items array', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi
            .fn()
            .mockResolvedValue({ items: [machine1], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it('gets a machine by id returning 200', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(machine1),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { machineId: string };
    expect(body.machineId).toBe('machine-1');
  });

  it('returns 404 for unknown machine', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/no-such-machine`,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('lists agents returning items array', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [agent1], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it('gets an agent by id returning 200', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(agent1),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agentId: string };
    expect(body.agentId).toBe('agent-1');
  });

  it('returns 404 for unknown agent', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/no-such-agent`,
    );
    expect(res.status).toBe(404);
  });

  it('registers a machine returning 201', async () => {
    const saveMachineRegistration = vi.fn().mockResolvedValue(undefined);
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration,
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const body: Record<string, unknown> = {
      schemaVersion: 1,
      machineId: 'machine-new',
      workspaceId: 'workspace-1',
      endpointUrl: 'https://machine.example.com',
      active: false,
      displayName: 'New Machine',
      capabilities: [{ capability: 'robotics:move' }],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://allowed.example.com'],
        workloadIdentity: 'Required',
      },
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(201);
    const responseBody = (await res.json()) as { machineId: string };
    expect(responseBody.machineId).toBe('machine-new');
    expect(saveMachineRegistration).toHaveBeenCalledOnce();
  });

  it('rejects register with invalid machine body returning 400', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('enforces workspace scope for register machine', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ workspaceId: 'workspace-1' }),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const body: Record<string, unknown> = {
      schemaVersion: 1,
      machineId: 'machine-ws2',
      workspaceId: 'workspace-2',
      endpointUrl: 'https://machine.example.com',
      active: false,
      displayName: 'WS2 Machine',
      capabilities: [{ capability: 'robotics:move' }],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://allowed.example.com'],
        workloadIdentity: 'Required',
      },
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-2/machines`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(403);
  });

  // ---------------------------------------------------------------------------
  // Security: authConfig browser-exposure prevention (bead-0800)
  // ---------------------------------------------------------------------------

  it('GET /machines/{id} strips authConfig — credential references must not reach the browser', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(machineWithAuthConfig),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines/machine-with-auth`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { machineId: string; authConfig?: unknown };
    expect(body.machineId).toBe('machine-with-auth');
    // authConfig must be absent — credential references must not reach the browser
    expect(body.authConfig).toBeUndefined();
  });

  it('GET /machines (list) strips authConfig from all items', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi
            .fn()
            .mockResolvedValue({ items: [machineWithAuthConfig], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { authConfig?: unknown }[] };
    expect(body.items).toHaveLength(1);
    // Each item must not expose authConfig
    expect(body.items[0]?.authConfig).toBeUndefined();
  });

  it('creates an agent returning 201', async () => {
    const saveAgentConfig = vi.fn().mockResolvedValue(undefined);
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig,
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const body: Record<string, unknown> = {
      schemaVersion: 1,
      agentId: 'agent-new',
      workspaceId: 'workspace-1',
      machineId: 'machine-1',
      displayName: 'New Agent',
      capabilities: [{ capability: 'robotics:move' }],
      policyTier: 'HumanApprove',
      allowedTools: [],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(201);
    const responseBody = (await res.json()) as { agentId: string };
    expect(responseBody.agentId).toBe('agent-new');
    expect(saveAgentConfig).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// OpenClaw integration: full create-connect-display-run lifecycle (bead-0801)
// ---------------------------------------------------------------------------

describe('OpenClaw integration: create → connect → display → run lifecycle', () => {
  it('GET /agents/{id} preserves machineId and policyTier in response body', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(agent1),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agentId: string;
      machineId?: string;
      policyTier?: string;
    };
    expect(body.agentId).toBe('agent-1');
    expect(body.machineId).toBe('machine-1');
    expect(body.policyTier).toBe('HumanApprove');
  });

  it('GET /agents list with ?machineId= passes filter to the store', async () => {
    const listAgentConfigs = vi.fn().mockResolvedValue({ items: [agent1], nextCursor: undefined });
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs,
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents?machineId=machine-1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    // Verify the machineId filter was forwarded to the store
    // listAgentConfigs is called as (tenantId, query)
    expect(listAgentConfigs).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ machineId: expect.anything() }),
    );
  });

  it('GET /agents list without ?machineId= omits machineId from store query', async () => {
    const listAgentConfigs = vi.fn().mockResolvedValue({ items: [agent1], nextCursor: undefined });
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          listMachineRegistrations: vi.fn().mockResolvedValue({ items: [], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          listAgentConfigs,
        },
      }),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
    );
    expect(res.status).toBe(200);
    // machineId must NOT appear in the store query when not specified
    // listAgentConfigs is called as (tenantId, query)
    expect(listAgentConfigs).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ machineId: expect.anything() }),
    );
  });

  it('auditor role cannot register a machine (403 Forbidden)', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ roles: ['auditor'] }),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const body: Record<string, unknown> = {
      schemaVersion: 1,
      machineId: 'machine-auditor',
      workspaceId: 'workspace-1',
      endpointUrl: 'https://machine.example.com',
      active: false,
      displayName: 'Auditor Machine',
      capabilities: [],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: [],
        workloadIdentity: 'Required',
      },
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('auditor role cannot create an agent (403 Forbidden)', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ roles: ['auditor'] }),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    const body: Record<string, unknown> = {
      schemaVersion: 1,
      agentId: 'agent-auditor',
      workspaceId: 'workspace-1',
      displayName: 'Auditor Agent',
      capabilities: [],
      allowedTools: [],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
  });

  it('rejects agent creation when body workspaceId mismatches URL workspace (403)', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps({ workspaceId: 'workspace-1' }),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration: vi.fn().mockResolvedValue(undefined),
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig: vi.fn().mockResolvedValue(undefined),
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
      }),
    });

    // Body says workspace-2 but URL says workspace-1 — must be rejected
    // Include all required fields so parse succeeds and workspace check fires
    const body: Record<string, unknown> = {
      schemaVersion: 1,
      agentId: 'agent-ws2',
      workspaceId: 'workspace-2',
      machineId: 'machine-1',
      displayName: 'WS2 Agent',
      capabilities: [{ capability: 'robotics:move' }],
      policyTier: 'Auto',
      allowedTools: [],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    };

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    expect(res.status).toBe(403);
  });

  it('OpenClaw full lifecycle: register machine → register agent → display agent with machineId+policyTier → heartbeat liveness', async () => {
    // Phase 1: register machine
    const saveMachineRegistration = vi.fn().mockResolvedValue(undefined);
    const saveAgentConfig = vi.fn().mockResolvedValue(undefined);

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        ...makeDeps(),
        machineRegistryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(null),
          saveMachineRegistration,
          getAgentConfigById: vi.fn().mockResolvedValue(null),
          saveAgentConfig,
          updateMachineHeartbeat: vi.fn().mockResolvedValue(true),
          updateAgentHeartbeat: vi.fn().mockResolvedValue(true),
        },
        machineQueryStore: {
          getMachineRegistrationById: vi.fn().mockResolvedValue(machine1),
          listMachineRegistrations: vi
            .fn()
            .mockResolvedValue({ items: [machine1], nextCursor: undefined }),
          getAgentConfigById: vi.fn().mockResolvedValue(agent1),
          listAgentConfigs: vi.fn().mockResolvedValue({ items: [agent1], nextCursor: undefined }),
        },
      }),
    });

    // Step 1: register the machine
    const machineBody: Record<string, unknown> = {
      schemaVersion: 1,
      machineId: 'machine-1',
      workspaceId: 'workspace-1',
      endpointUrl: 'https://edge-gateway.example.com',
      active: false, // active=true requires authConfig; use false for registration
      displayName: 'OpenClaw Edge Gateway',
      capabilities: [{ capability: 'machine:invoke' }],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
      executionPolicy: {
        isolationMode: 'PerTenantWorker',
        egressAllowlist: ['https://edge-gateway.example.com'],
        workloadIdentity: 'Required',
      },
    };
    const machineRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/machines`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(machineBody),
      },
    );
    expect(machineRes.status).toBe(201);
    const machineCreated = (await machineRes.json()) as { machineId: string };
    expect(machineCreated.machineId).toBe('machine-1');
    expect(saveMachineRegistration).toHaveBeenCalledOnce();

    // Step 2: register OpenClaw agent connected to the machine with HumanApprove policy
    const agentBody: Record<string, unknown> = {
      schemaVersion: 1,
      agentId: 'agent-1',
      workspaceId: 'workspace-1',
      machineId: 'machine-1',
      displayName: 'Test Agent',
      capabilities: [{ capability: 'robotics:move' }],
      policyTier: 'HumanApprove',
      allowedTools: [],
      registeredAtIso: '2026-01-01T00:00:00.000Z',
    };
    const agentRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(agentBody),
      },
    );
    expect(agentRes.status).toBe(201);
    const agentCreated = (await agentRes.json()) as { agentId: string };
    expect(agentCreated.agentId).toBe('agent-1');
    expect(saveAgentConfig).toHaveBeenCalledOnce();

    // Step 3: GET the agent — verify machineId + policyTier are preserved (display phase)
    const getAgentRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-1`,
    );
    expect(getAgentRes.status).toBe(200);
    const agentView = (await getAgentRes.json()) as {
      agentId: string;
      machineId?: string;
      policyTier?: string;
    };
    expect(agentView.agentId).toBe('agent-1');
    expect(agentView.machineId).toBe('machine-1');
    expect(agentView.policyTier).toBe('HumanApprove');

    // Step 4: agent heartbeat — liveness check (run phase)
    const heartbeatRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/agents/agent-1/heartbeat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ok', metrics: { tasksQueued: 3 } }),
      },
    );
    expect(heartbeatRes.status).toBe(200);
    const hb = (await heartbeatRes.json()) as {
      agentId: string;
      status: string;
      lastHeartbeatAtIso: string;
    };
    expect(hb.agentId).toBe('agent-1');
    expect(hb.status).toBe('ok');
    expect(typeof hb.lastHeartbeatAtIso).toBe('string');
  });
});
