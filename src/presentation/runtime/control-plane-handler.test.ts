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

function makeCtx() {
  return toAppContext({
    tenantId: 'tenant-1',
    principalId: 'user-1',
    roles: ['admin'],
    correlationId: 'corr-1',
  });
}

describe('createControlPlaneHandler', () => {
  it('routes GET workspace to application query and returns Problem Details on not found', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx()),
      },
      authorization: {
        isAllowed: async () => true,
      },
      workspaceStore: {
        getWorkspaceById: async () => null,
        saveWorkspace: async () => undefined,
      },
      runStore: {
        getRunById: async () => null,
        saveRun: async () => undefined,
      },
    };

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/not-found/);
    expect(body.status).toBe(404);
  });

  it('routes GET run to application query and returns Problem Details on unauthorized', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () =>
          err({ kind: 'Unauthorized', message: 'Missing token.' }),
      },
      authorization: {
        isAllowed: async () => true,
      },
      workspaceStore: {
        getWorkspaceById: async () => null,
        saveWorkspace: async () => undefined,
      },
      runStore: {
        getRunById: async () => null,
        saveRun: async () => undefined,
      },
    };

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-1/runs/run-1`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { type: string; status: number; title: string };
    expect(body.type).toMatch(/unauthorized/);
    expect(body.status).toBe(401);
    expect(body.title).toBe('Unauthorized');
  });

  it('returns Problem Details not-found for unknown routes', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler({
        authentication: {
          authenticateBearerToken: async () => ok(makeCtx()),
        },
        authorization: {
          isAllowed: async () => true,
        },
        workspaceStore: {
          getWorkspaceById: async () => null,
          saveWorkspace: async () => undefined,
        },
        runStore: {
          getRunById: async () => null,
          saveRun: async () => undefined,
        },
      }),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/nope`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { detail: string };
    expect(body.detail).toBe('Route not found.');
  });
});

