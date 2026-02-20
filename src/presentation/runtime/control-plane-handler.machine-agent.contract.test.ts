import { afterEach, describe, expect, it } from 'vitest';

import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { ok, err } from '../../application/common/result.js';
import { toAppContext } from '../../application/common/context.js';

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
