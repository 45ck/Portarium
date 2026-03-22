import { afterEach, describe, expect, it } from 'vitest';

import {
  startHealthServer,
  type HealthServerHandle,
  type ReadinessResult,
} from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('startHealthServer', () => {
  it('serves JSON health at /healthz (liveness)', async () => {
    handle = await startHealthServer({ role: 'control-plane', port: 0, host: '127.0.0.1' });
    const base = `http://${handle.host}:${handle.port}`;

    for (const path of ['/healthz', '/health', '/livez']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { service: string; status: string; startedAt: string };
      expect(json.service).toBe('control-plane');
      expect(json.status).toBe('ok');
      expect(typeof json.startedAt).toBe('string');
    }
  });

  it('serves readiness at /readyz without check (defaults to ok)', async () => {
    handle = await startHealthServer({ role: 'control-plane', port: 0, host: '127.0.0.1' });
    const base = `http://${handle.host}:${handle.port}`;

    for (const path of ['/readyz', '/ready']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { status: string };
      expect(json.status).toBe('ok');
    }
  });

  it('returns 200 when readiness check passes', async () => {
    const readinessCheck = async (): Promise<ReadinessResult> => ({
      ok: true,
      checks: { database: { ok: true } },
    });
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      readinessCheck,
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; checks: Record<string, unknown> };
    expect(json.status).toBe('ok');
    expect(json.checks).toEqual({ database: { ok: true } });
  });

  it('returns 503 when readiness check fails', async () => {
    const readinessCheck = async (): Promise<ReadinessResult> => ({
      ok: false,
      checks: { database: { ok: false, message: 'Connection refused' } },
    });
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      readinessCheck,
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
    expect(res.status).toBe(503);
    const json = (await res.json()) as { status: string; checks: Record<string, unknown> };
    expect(json.status).toBe('unavailable');
    expect(json.checks).toEqual({ database: { ok: false, message: 'Connection refused' } });
  });

  it('returns 503 when readiness check throws', async () => {
    const readinessCheck = async (): Promise<ReadinessResult> => {
      throw new Error('boom');
    };
    handle = await startHealthServer({
      role: 'control-plane',
      port: 0,
      host: '127.0.0.1',
      readinessCheck,
    });

    const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
    expect(res.status).toBe(503);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe('unavailable');
  });

  it('serves a plain-text banner for non-health paths', async () => {
    handle = await startHealthServer({ role: 'execution-plane', port: 0, host: '127.0.0.1' });

    const res = await fetch(`http://${handle.host}:${handle.port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Portarium execution-plane runtime/i);
  });
});
