import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  delete process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'];
  delete process.env['PORTARIUM_CONTAINER_ROLE'];
  delete process.env['PORTARIUM_HTTP_PORT'];
  vi.resetModules();
  vi.clearAllMocks();
});

describe('worker runtime main (Temporal disabled)', () => {
  it.each(['false', '0', 'no', 'off'] as const)(
    'does not start Temporal worker when PORTARIUM_ENABLE_TEMPORAL_WORKER=%s',
    async (value) => {
      process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'] = value;

      const createTemporalWorker = vi.fn(async () => {
        throw new Error('should not be called');
      });

      vi.doMock('../../infrastructure/temporal/temporal-worker.js', () => ({
        createTemporalWorker,
      }));

      const mod = await import('./worker.js');
      handle = await mod.main({ host: '127.0.0.1', port: 0 });

      const res = await fetch(`http://${handle.host}:${handle.port}/readyz`);
      expect(res.status).toBe(200);
      expect(createTemporalWorker).toHaveBeenCalledTimes(0);
    },
  );
});
