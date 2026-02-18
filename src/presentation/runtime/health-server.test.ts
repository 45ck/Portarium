import { afterEach, describe, expect, it } from 'vitest';

import { startHealthServer, type HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('startHealthServer', () => {
  it('serves JSON health at /healthz and /readyz', async () => {
    handle = await startHealthServer({ role: 'control-plane', port: 0, host: '127.0.0.1' });

    const base = `http://${handle.host}:${handle.port}`;

    for (const path of ['/healthz', '/readyz']) {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { service: string; status: string; startedAt: string };
      expect(json.service).toBe('control-plane');
      expect(json.status).toBe('ok');
      expect(typeof json.startedAt).toBe('string');
      expect(json.startedAt.length).toBeGreaterThan(0);
    }
  });

  it('serves a plain-text banner for non-health paths', async () => {
    handle = await startHealthServer({ role: 'execution-plane', port: 0, host: '127.0.0.1' });

    const res = await fetch(`http://${handle.host}:${handle.port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toMatch(/Portarium execution-plane runtime/i);
  });
});
