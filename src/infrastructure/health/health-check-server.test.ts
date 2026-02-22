/**
 * Tests for HealthCheckServer.
 * Bead: bead-0396
 */

import { describe, it, expect, afterEach } from 'vitest';
import { HealthCheckServer } from './health-check-server.js';

async function get(port: number, path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const body = await res.json().catch(() => res.text());
  return { status: res.status, body };
}

/** Create a server bound to 127.0.0.1 on an OS-assigned port and return both. */
async function startServer(
  opts: Omit<ConstructorParameters<typeof HealthCheckServer>[0], 'port' | 'host'> = {},
): Promise<{ server: HealthCheckServer; port: number }> {
  const server = new HealthCheckServer({ ...opts, port: 0, host: '127.0.0.1' });
  await server.start();
  return { server, port: server.actualPort };
}

describe('HealthCheckServer', () => {
  let server: HealthCheckServer;

  afterEach(async () => {
    await server?.stop();
  });

  it('returns 200 on /health/live when liveness check passes', async () => {
    ({ server } = await startServer());
    const { status, body } = await get(server.actualPort, '/health/live');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('ok');
  });

  it('returns 200 on /health/ready when readiness check passes', async () => {
    ({ server } = await startServer());
    const { status } = await get(server.actualPort, '/health/ready');
    expect(status).toBe(200);
  });

  it('returns 200 on /health/startup when startup check passes', async () => {
    ({ server } = await startServer());
    const { status } = await get(server.actualPort, '/health/startup');
    expect(status).toBe(200);
  });

  it('returns 503 on /health/live when liveness check returns fail', async () => {
    ({ server } = await startServer({
      livenessCheck: () => ({ status: 'fail', message: 'deadlock detected' }),
    }));
    const { status, body } = await get(server.actualPort, '/health/live');
    expect(status).toBe(503);
    expect((body as { status: string }).status).toBe('fail');
    expect((body as { message: string }).message).toBe('deadlock detected');
  });

  it('returns 503 on /health/ready when readiness check returns fail', async () => {
    ({ server } = await startServer({
      readinessCheck: () => ({ status: 'fail', message: 'db not connected' }),
    }));
    const { status } = await get(server.actualPort, '/health/ready');
    expect(status).toBe(503);
  });

  it('returns 200 on /health/ready when status is degraded (non-fatal)', async () => {
    ({ server } = await startServer({
      readinessCheck: () => ({ status: 'degraded', message: 'cache miss rate elevated' }),
    }));
    const { status, body } = await get(server.actualPort, '/health/ready');
    expect(status).toBe(200);
    expect((body as { status: string }).status).toBe('degraded');
  });

  it('returns 404 for unknown paths', async () => {
    ({ server } = await startServer());
    const res = await fetch(`http://127.0.0.1:${server.actualPort}/unknown`);
    expect(res.status).toBe(404);
  });

  it('supports legacy /healthz and /readyz aliases', async () => {
    ({ server } = await startServer());
    const port = server.actualPort;
    expect((await get(port, '/healthz')).status).toBe(200);
    expect((await get(port, '/readyz')).status).toBe(200);
    expect((await get(port, '/startupz')).status).toBe(200);
  });

  it('includes sub-checks in response body', async () => {
    ({ server } = await startServer({
      readinessCheck: () => ({
        status: 'ok',
        checks: {
          database: { status: 'ok' },
          temporal: { status: 'ok' },
        },
      }),
    }));
    const { body } = await get(server.actualPort, '/health/ready');
    expect((body as { checks: { database: { status: string } } }).checks.database.status).toBe(
      'ok',
    );
  });

  it('supports async health check functions', async () => {
    ({ server } = await startServer({
      livenessCheck: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { status: 'ok' };
      },
    }));
    const { status } = await get(server.actualPort, '/health/live');
    expect(status).toBe(200);
  });
});
