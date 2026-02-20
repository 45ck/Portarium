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

function makeCtx(roles: readonly ('admin' | 'operator' | 'approver' | 'auditor')[] = ['admin']) {
  return toAppContext({
    tenantId: 'tenant-1',
    principalId: 'user-1',
    roles,
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
        getWorkspaceByName: async () => null,
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
    expect(res.headers.get('traceparent')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/not-found/);
    expect(body.status).toBe(404);
  });

  it('routes GET run to application query and returns Problem Details on unauthorized', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () =>
          err({ kind: 'Unauthorized' as const, message: 'Missing token.' }),
      },
      authorization: {
        isAllowed: async () => true,
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
          getWorkspaceByName: async () => null,
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

  it('maps ValidationFailed to 400 and preserves x-correlation-id when provided', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx()),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/%20`, {
      headers: {
        'x-correlation-id': 'corr-fixed',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        tracestate: 'vendor=value',
      },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('x-correlation-id')).toBe('corr-fixed');
    expect(res.headers.get('traceparent')).toBe(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
    expect(res.headers.get('tracestate')).toBe('vendor=value');
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/validation-failed/);
    expect(body.status).toBe(400);
  });

  it('maps Forbidden to 403', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx()),
      },
      authorization: {
        isAllowed: async () => false,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/forbidden/);
    expect(body.status).toBe(403);
  });

  it('returns 500 Problem Details when a dependency throws', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => {
          throw new Error('boom');
        },
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-1`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { type: string; status: number };
    expect(body.type).toMatch(/internal/);
    expect(body.status).toBe(500);
  });

  it('lists workforce members with contract query filters', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/workforce?capability=operations.approval&availability=available`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ workforceMemberId: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.workforceMemberId).toBe('wm-1');
  });

  it('enforces admin-only update for workforce availability patch', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/workforce/wm-1/availability`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: 'offline' }),
      },
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe('Forbidden');
  });

  it('allows admin to patch workforce availability', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['admin'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/workforce/wm-1/availability`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ availabilityStatus: 'offline' }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { availabilityStatus: string; workforceMemberId: string };
    expect(body.workforceMemberId).toBe('wm-1');
    expect(body.availabilityStatus).toBe('offline');
  });

  it('lists human tasks with assignee/status filters', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/human-tasks?assigneeId=wm-1&status=assigned`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ humanTaskId: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.humanTaskId).toBe('ht-1');
  });

  it('completes human task and emits evidence visible in evidence list', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const completeRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/human-tasks/ht-1/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ completionNote: 'Done' }),
      },
    );
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()) as { status: string; evidenceAnchorId?: string };
    expect(completed.status).toBe('completed');
    expect(typeof completed.evidenceAnchorId).toBe('string');

    const evidenceRes = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/evidence?category=Action`,
    );
    expect(evidenceRes.status).toBe(200);
    const evidenceBody = (await evidenceRes.json()) as {
      items: Array<{ evidenceId: string; summary: string }>;
    };
    expect(evidenceBody.items.some((entry) => entry.evidenceId === completed.evidenceAnchorId)).toBe(
      true,
    );
  });

  it('lists location events in a bounded playback window with filters', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/location-events?fromIso=2026-02-20T10:00:00.000Z&toIso=2026-02-20T10:10:00.000Z&sourceType=SLAM&siteId=site-a&floorId=floor-1&limit=1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ locationEventId: string; tenantId: string; sourceType: string }>;
      nextCursor?: string;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.locationEventId).toBe('loc-evt-1');
    expect(body.items[0]!.sourceType).toBe('SLAM');
  });

  it('serves location stream endpoint as text/event-stream with stale semantics metadata', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-1/location-events:stream?assetId=asset-1&purpose=operations`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/i);
    const text = await res.text();
    expect(text).toContain('event: stream-metadata');
    expect(text).toContain('event: location');
    expect(text).toContain('staleAfterSeconds');
  });

  it('lists map layers and enforces tenant isolation by workspace route', async () => {
    const deps = {
      authentication: {
        authenticateBearerToken: async () => ok(makeCtx(['operator'])),
      },
      authorization: {
        isAllowed: async () => true,
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

    handle = await startHealthServer({
      role: 'control-plane',
      host: '127.0.0.1',
      port: 0,
      handler: createControlPlaneHandler(deps),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/workspace-2/map-layers?version=1`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ tenantId: string; mapLayerId: string; version: number }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.tenantId).toBe('workspace-2');
    expect(body.items[0]!.mapLayerId).toBe('ml-ws2-floor1');
    expect(body.items[0]!.version).toBe(1);
  });
});
