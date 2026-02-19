import { afterEach, describe, expect, it } from 'vitest';

import { main } from './worker.js';
import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  delete process.env['PORTARIUM_CONTAINER_ROLE'];
  delete process.env['PORTARIUM_HTTP_PORT'];
  delete process.env['PORTARIUM_TENANT_ISOLATION_MODE'];
  delete process.env['PORTARIUM_SANDBOX_ASSERTIONS'];
  delete process.env['PORTARIUM_EGRESS_ALLOWLIST'];
});

describe('worker runtime main', () => {
  it('defaults role to execution-plane and serves readiness', async () => {
    process.env['PORTARIUM_HTTP_PORT'] = '0';
    handle = await main({ host: '127.0.0.1' });
    const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { service: string };
    expect(json.service).toBe('execution-plane');
  });

  it('fails startup when tenant isolation mode is not per-tenant-worker', async () => {
    process.env['PORTARIUM_TENANT_ISOLATION_MODE'] = 'shared-worker';
    await expect(main({ host: '127.0.0.1', port: 0 })).rejects.toThrow(
      /tenant_isolation_mode must be "per-tenant-worker"/i,
    );
  });
});
