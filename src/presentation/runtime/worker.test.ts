import { afterEach, describe, expect, it } from 'vitest';

import { main } from './worker.js';
import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  delete process.env['PORTARIUM_CONTAINER_ROLE'];
  delete process.env['PORTARIUM_HTTP_PORT'];
});

describe('worker runtime main', () => {
  it('defaults role to execution-plane and serves readiness', async () => {
    handle = await main({ host: '127.0.0.1', port: 0 });
    const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { service: string };
    expect(json.service).toBe('execution-plane');
  });
});
