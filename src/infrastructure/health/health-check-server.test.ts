/**
 * Tests for HealthCheckServer.
 * Bead: bead-0396
 */

import { describe, it, expect, afterEach } from 'vitest';
import { HealthCheckServer } from './health-check-server.js';

function getPort(): number {
  // Use a high random port to avoid conflicts in parallel test runs.
  return 49000 + Math.floor(Math.random() * 1000);
}

async function get(port: number, path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.json().catch(() => res.text());
  return { status: res.status, body };
}

describe('HealthCheckServer', () => {
  let server: HealthCheckServer;
  let port: number;

  afterEach(async () => {
    await server?.stop();
  });

  it('returns 200 on /health/live when liveness check passes', async () => {
    port = getPort();
    server = new HealthCheckServer({ port });
    await server.start();

    const { status, body } = await get(port, '/health/live');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ok');
  });

  it('returns 200 on /health/ready when readiness check passes', async () => {
    port = getPort();
    server = new HealthCheckServer({ port });
    await server.start();

    const { status } = await get(port, '/health/ready');
    expect(status).toBe(200);
  });

  it('returns 200 on /health/startup when startup check passes', async () => {
    port = getPort();
    server = new HealthCheckServer({ port });
    await server.start();

    const { status } = await get(port, '/health/startup');
    expect(status).toBe(200);
  });

  it('returns 503 on /health/live when liveness check returns fail', async () => {
    port = getPort();
    server = new HealthCheckServer({
      port,
      livenessCheck: () => ({ status: 'fail', message: 'deadlock detected' }),
    });
    await server.start();

    const { status, body } = await get(port, '/health/live');
    expect(status).toBe(503);
    expect((body as { status: string }).status).toBe('fail');
    expect((body as { message: string }).message).toBe('deadlock detected');
  });

  it('returns 503 on /health/ready when readiness check returns fail', async () => {
    port = getPort();
    server = new HealthCheckServer({
      port,
      readinessCheck: () => ({ status: 'fail', message: 'db not connected' }),
    });
    await server.start();

    const { status } = await get(port, '/health/ready');
    expect(status).toBe(503);
  });

  it('returns 200 on /health/ready when status is degraded (non-fatal)', async () => {
    port = getPort();
    server = new HealthCheckServer({
      port,
      readinessCheck: () => ({ status: 'degraded', message: 'cache miss rate elevated' }),
    });
    await server.start();

    const { status, body } = await get(port, '/health/ready');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('degraded');
  });

  it('returns 404 for unknown paths', async () => {
    port = getPort();
    server = new HealthCheckServer({ port });
    await server.start();

    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it('supports legacy /healthz and /readyz aliases', async () => {
    port = getPort();
    server = new HealthCheckServer({ port });
    await server.start();

    expect((await get(port, '/healthz')).status).toBe(200);
    expect((await get(port, '/readyz')).status).toBe(200);
    expect((await get(port, '/startupz')).status).toBe(200);
  });

  it('includes sub-checks in response body', async () => {
    port = getPort();
    server = new HealthCheckServer({
      port,
      readinessCheck: () => ({
        status: 'ok',
        checks: {
          database: { status: 'ok' },
          temporal: { status: 'ok' },
        },
      }),
    });
    await server.start();

    const { body } = await get(port, '/health/ready');
    expect((body as { checks: { database: { status: string } } }).checks.database.status).toBe('ok');
  });

  it('supports async health check functions', async () => {
    port = getPort();
    server = new HealthCheckServer({
      port,
      livenessCheck: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { status: 'ok' };
      },
    });
    await server.start();

    const { status } = await get(port, '/health/live');
    expect(status).toBe(200);
  });
});
