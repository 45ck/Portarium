import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HealthServerHandle } from './health-server.js';

let handle: HealthServerHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  delete process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'];
  delete process.env['PORTARIUM_CONTAINER_ROLE'];
  delete process.env['PORTARIUM_HTTP_PORT'];
  delete process.env['PORTARIUM_ROLE'];
  process.exitCode = undefined;
  vi.resetModules();
  vi.clearAllMocks();
});

describe('worker runtime main (Temporal enabled)', () => {
  it('starts Temporal worker when PORTARIUM_ENABLE_TEMPORAL_WORKER is truthy', async () => {
    process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'] = 'true';

    const createTemporalWorker = vi.fn(async () => ({
      config: { address: 'temporal:7233', namespace: 'default', taskQueue: 'portarium-runs' },
      run: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
    }));

    vi.doMock('../../infrastructure/temporal/temporal-worker.js', () => ({
      createTemporalWorker,
    }));

    const mod = await import('./worker.js');
    handle = await mod.main({ host: '127.0.0.1', port: 0 });

    const res = await fetch(`http://${handle.host}:${handle.port}/healthz`);
    expect(res.status).toBe(200);
    expect(createTemporalWorker).toHaveBeenCalledTimes(1);
  });

  it('sets exitCode=1 when Temporal worker run() rejects', async () => {
    process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'] = 'true';

    const createTemporalWorker = vi.fn(async () => ({
      config: { address: 'temporal:7233', namespace: 'default', taskQueue: 'portarium-runs' },
      run: vi.fn(async () => {
        throw new Error('boom');
      }),
      shutdown: vi.fn(async () => undefined),
    }));

    vi.doMock('../../infrastructure/temporal/temporal-worker.js', () => ({
      createTemporalWorker,
    }));

    const mod = await import('./worker.js');
    handle = await mod.main({ host: '127.0.0.1', port: 0 });

    // Allow the run().catch handler to execute.
    await new Promise((r) => setTimeout(r, 0));

    expect(process.exitCode).toBe(1);
  });

  it('shuts down Temporal worker and HTTP server on SIGTERM without exiting the test process', async () => {
    process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'] = 'true';

    let resolveRun: (() => void) | undefined;
    const run = vi.fn(
      async () =>
        await new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const shutdown = vi.fn(async () => {
      resolveRun?.();
    });

    const createTemporalWorker = vi.fn(async () => ({
      config: { address: 'temporal:7233', namespace: 'default', taskQueue: 'portarium-runs' },
      run,
      shutdown,
    }));

    vi.doMock('../../infrastructure/temporal/temporal-worker.js', () => ({
      createTemporalWorker,
    }));

    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const mod = await import('./worker.js');
    handle = await mod.main({ host: '127.0.0.1', port: 0 });

    process.emit('SIGTERM');

    // Wait for shutdown to complete.
    await new Promise((r) => setTimeout(r, 0));

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(handle.server.listening).toBe(false);

    exit.mockRestore();
  });
});
