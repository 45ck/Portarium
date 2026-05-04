import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { toAppContext } from '../../application/common/context.js';
import { ok } from '../../application/common/result.js';
import { createControlPlaneHandler } from './control-plane-handler.js';
import type { HealthServerHandle } from './health-server.js';
import { startHealthServer } from './health-server.js';
import type { ControlPlaneDeps } from './control-plane-handler.shared.js';

let handle: HealthServerHandle | undefined;
let previousMetricsToken: string | undefined;
let previousNodeEnv: string | undefined;
let previousCorsAllowedOrigins: string | undefined;

beforeEach(() => {
  previousMetricsToken = process.env['PORTARIUM_METRICS_TOKEN'];
  previousNodeEnv = process.env['NODE_ENV'];
  previousCorsAllowedOrigins = process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'];
});

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (previousMetricsToken === undefined) {
    delete process.env['PORTARIUM_METRICS_TOKEN'];
  } else {
    process.env['PORTARIUM_METRICS_TOKEN'] = previousMetricsToken;
  }
  if (previousNodeEnv === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = previousNodeEnv;
  }
  if (previousCorsAllowedOrigins === undefined) {
    delete process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'];
  } else {
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = previousCorsAllowedOrigins;
  }
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

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      headers: { authorization: 'Bearer test-token' },
    });

    expect(res.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('does not set HSTS in development/test mode', async () => {
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      headers: { authorization: 'Bearer test-token' },
    });

    // HSTS should not be set in test environment (plain HTTP)
    expect(res.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('control-plane CORS policy', () => {
  it('omits CORS headers in production same-origin mode when no allowlist is configured', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'];
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      headers: { authorization: 'Bearer test-token', origin: 'https://cockpit.example.com' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('echoes an exact production CORS allowlist origin and varies by Origin', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = 'https://cockpit.example.com';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      headers: { authorization: 'Bearer test-token', origin: 'https://cockpit.example.com' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('https://cockpit.example.com');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('vary')).toMatch(/origin/i);
  });

  it('does not grant CORS to suffix-matched or otherwise unlisted origins', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = 'https://cockpit.example.com';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://cockpit.example.com.evil.test',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers allowed preflight requests with CORS headers', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = 'https://cockpit.example.com';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://cockpit.example.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, x-portarium-request, idempotency-key',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://cockpit.example.com');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('idempotency-key');
    expect(res.headers.get('access-control-allow-headers')).toContain('x-portarium-request');
  });

  it('rejects disallowed preflight requests without allow headers', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['PORTARIUM_CORS_ALLOWED_ORIGINS'] = 'https://cockpit.example.com';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/v1/workspaces/ws-sec-test`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('control-plane metrics endpoint security', () => {
  it('does not expose metrics when PORTARIUM_METRICS_TOKEN is unset', async () => {
    delete process.env['PORTARIUM_METRICS_TOKEN'];
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/metrics`);

    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toMatch(/application\/json/i);
    expect(await res.text()).not.toContain('# HELP');
  });

  it('rejects metrics requests without a valid bearer token', async () => {
    process.env['PORTARIUM_METRICS_TOKEN'] = 'metrics-secret';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const missing = await fetch(`http://${handle.host}:${handle.port}/metrics`);
    const wrong = await fetch(`http://${handle.host}:${handle.port}/metrics`, {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const nonBearer = await fetch(`http://${handle.host}:${handle.port}/metrics`, {
      headers: { authorization: 'metrics-secret' },
    });

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(nonBearer.status).toBe(401);
  });

  it('returns Prometheus metrics only with the configured bearer token', async () => {
    process.env['PORTARIUM_METRICS_TOKEN'] = 'metrics-secret';
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      handler: createControlPlaneHandler(makeDeps()),
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/metrics`, {
      headers: { authorization: 'Bearer metrics-secret' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/i);
    expect(await res.text()).toContain('# HELP');
  });
});
