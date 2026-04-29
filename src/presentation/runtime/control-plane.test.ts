import { afterEach, describe, expect, it } from 'vitest';

import { main } from './control-plane.js';
import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  delete process.env['PORTARIUM_CONTAINER_ROLE'];
  delete process.env['PORTARIUM_HTTP_PORT'];
  delete process.env['DEV_STUB_STORES'];
  delete process.env['ENABLE_DEV_AUTH'];
  delete process.env['PORTARIUM_DEV_TOKEN'];
  delete process.env['PORTARIUM_DEV_WORKSPACE_ID'];
  delete process.env['NODE_ENV'];
});

describe('control-plane runtime main', () => {
  it('uses PORTARIUM_CONTAINER_ROLE and serves health', async () => {
    process.env['PORTARIUM_CONTAINER_ROLE'] = 'control-plane';
    process.env['PORTARIUM_HTTP_PORT'] = '0';
    process.env['NODE_ENV'] = 'test';
    process.env['DEV_STUB_STORES'] = 'true';
    process.env['ENABLE_DEV_AUTH'] = 'true';
    process.env['PORTARIUM_DEV_TOKEN'] = 'dev-token';
    process.env['PORTARIUM_DEV_WORKSPACE_ID'] = 'ws-local-dev';

    handle = await main({ host: '127.0.0.1' });
    const res = await fetch(`http://${handle.host}:${handle.port}/healthz`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { service: string };
    expect(json.service).toBe('control-plane');
  });
});
