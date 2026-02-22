import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { TenantId } from '../../domain/primitives/index.js';
import { InMemoryRateLimitStore } from '../../infrastructure/rate-limiting/index.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';

const WORKSPACE_ID = 'workspace-rl-test';

let handle: HealthServerHandle | undefined;
let store: InMemoryRateLimitStore;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  store?.clear();
});

function makeCtx() {
  return toAppContext({
    tenantId: WORKSPACE_ID,
    principalId: 'user-1',
    roles: ['operator'],
    correlationId: 'corr-rl',
  });
}

function makeDeps(maxRequests: number): ControlPlaneDeps {
  store = new InMemoryRateLimitStore();
  const scope = { kind: 'Tenant' as const, tenantId: TenantId(WORKSPACE_ID) };
  store.setRules(scope, [
    {
      schemaVersion: 1,
      scope,
      window: 'PerMinute',
      maxRequests,
    },
  ]);

  return {
    authentication: { authenticateBearerToken: async () => ok(makeCtx()) },
    authorization: { isAllowed: async () => true },
    workspaceStore: {
      getWorkspaceById: async () => null,
      getWorkspaceByName: async () => null,
      saveWorkspace: async () => undefined,
    },
    runStore: {
      getRunById: async () => null,
      saveRun: async () => undefined,
    },
    rateLimitStore: store,
  };
}

async function startWith(deps: ControlPlaneDeps): Promise<void> {
  handle = await startHealthServer({
    role: 'control-plane',
    host: '127.0.0.1',
    port: 0,
    handler: createControlPlaneHandler(deps),
  });
}

describe('control-plane rate limiting', () => {
  it('returns 429 with RFC 9457 Problem Details body when rate limit is exceeded', async () => {
    await startWith(makeDeps(2));
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/workforce`;

    // First two requests are within limit.
    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(200);

    // Third request exceeds the limit.
    const res = await fetch(url);
    expect(res.status).toBe(429);
    expect(res.headers.get('content-type')).toMatch(/application\/problem\+json/i);
    const body = (await res.json()) as { type: string; status: number; title: string };
    expect(body.type).toMatch(/rate-limit-exceeded/);
    expect(body.status).toBe(429);
    expect(body.title).toBe('Too Many Requests');
  });

  it('sets a positive integer Retry-After header on 429 responses', async () => {
    await startWith(makeDeps(1));
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/human-tasks`;

    await fetch(url); // consume the single allowed request

    const res = await fetch(url);
    expect(res.status).toBe(429);

    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).not.toBeNull();
    const seconds = Number(retryAfter);
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThanOrEqual(1);
  });

  it('passes x-correlation-id and traceparent through on 429 responses', async () => {
    await startWith(makeDeps(1));
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/evidence`;

    // Consume the single allowed request first.
    await fetch(url);

    const res = await fetch(url, {
      headers: {
        'x-correlation-id': 'rl-corr-fixed',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get('x-correlation-id')).toBe('rl-corr-fixed');
    expect(res.headers.get('traceparent')).toBe(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
  });

  it('allows requests again after the store is cleared (window-reset simulation)', async () => {
    await startWith(makeDeps(1));
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/workforce`;

    await fetch(url); // consume the limit
    expect((await fetch(url)).status).toBe(429);

    // Simulate window reset by clearing and re-seeding store rules.
    store.clear();
    const scope = { kind: 'Tenant' as const, tenantId: TenantId(WORKSPACE_ID) };
    store.setRules(scope, [{ schemaVersion: 1, scope, window: 'PerMinute', maxRequests: 1 }]);

    expect((await fetch(url)).status).toBe(200);
  });

  it('gracefully sheds load: excess concurrent requests get 429 under tight rate limit', async () => {
    const limit = 5;
    await startWith(makeDeps(limit));
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/workforce`;

    // Fire 2× the limit concurrently.
    const results = await Promise.all(
      Array.from({ length: limit * 2 }, () =>
        fetch(url).then((r) => ({
          status: r.status,
          retryAfter: r.headers.get('Retry-After'),
        })),
      ),
    );

    const allowed = results.filter((r) => r.status === 200);
    const rejected = results.filter((r) => r.status === 429);

    expect(allowed.length).toBeGreaterThanOrEqual(limit);
    expect(rejected.length).toBeGreaterThan(0);
    // Every rejected response must carry a valid Retry-After header.
    for (const r of rejected) {
      expect(r.retryAfter).toMatch(/^\d+$/);
      expect(Number(r.retryAfter)).toBeGreaterThanOrEqual(1);
    }
  });

  it('does not rate-limit requests whose URL has no workspace segment', async () => {
    // Even with maxRequests=0 (deny everything), a non-workspace URL bypasses the check.
    await startWith(makeDeps(0));
    const res = await fetch(`http://${handle!.host}:${handle!.port}/v1/unknown-path`);
    // Route not found, but NOT rate-limited.
    expect(res.status).toBe(404);
    expect(res.headers.get('Retry-After')).toBeNull();
  });

  it('does not apply rate limit when no rateLimitStore is provided', async () => {
    // Omit rateLimitStore entirely — all workspace requests should pass through.
    const deps: ControlPlaneDeps = {
      authentication: { authenticateBearerToken: async () => ok(makeCtx()) },
      authorization: { isAllowed: async () => true },
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
    await startWith(deps);
    const url = `http://${handle!.host}:${handle!.port}/v1/workspaces/${WORKSPACE_ID}/workforce`;

    // Fire 20 requests — without a store none should be rate-limited.
    const statuses = await Promise.all(
      Array.from({ length: 20 }, () => fetch(url).then((r) => r.status)),
    );
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});
