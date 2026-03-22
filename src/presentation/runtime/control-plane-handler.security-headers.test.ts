import { afterEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

function makeDeps(): ControlPlaneDeps {
  return {
    authentication: {
      authenticateBearerToken: async () =>
        ok(
          toAppContext({
            tenantId: 'ws-sec-test',
            principalId: 'user-1',
            roles: ['operator'],
            correlationId: 'corr-sec',
          }),
        ),
    },
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
}

describe('control-plane security headers', () => {
  it('sets CSP, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`,
      { headers: { authorization: 'Bearer test-token' } },
    );

    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('does not set HSTS in development/test mode', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(
      `http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`,
      { headers: { authorization: 'Bearer test-token' } },
    );

    // HSTS should not be set in test environment (plain HTTP)
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });
});
