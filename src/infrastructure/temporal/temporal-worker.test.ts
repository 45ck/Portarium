import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@temporalio/worker', () => ({
  NativeConnection: {
    connect: vi.fn(async () => ({ close: vi.fn(async () => undefined) })),
  },
  Worker: {
    create: vi.fn(async () => ({ run: vi.fn(async () => undefined), shutdown: vi.fn() })),
  },
}));

import { createTemporalWorker, readTemporalWorkerConfig } from './temporal-worker.js';

afterEach(() => {
  delete process.env['PORTARIUM_TEMPORAL_ADDRESS'];
  delete process.env['PORTARIUM_TEMPORAL_NAMESPACE'];
  delete process.env['PORTARIUM_TEMPORAL_TASK_QUEUE'];
  vi.clearAllMocks();
});

describe('readTemporalWorkerConfig', () => {
  it('uses defaults when env vars are missing', () => {
    const cfg = readTemporalWorkerConfig();
    expect(cfg.address).toBe('127.0.0.1:7233');
    expect(cfg.namespace).toBe('default');
    expect(cfg.taskQueue).toBe('portarium-runs');
  });

  it('trims and respects env var overrides', () => {
    process.env['PORTARIUM_TEMPORAL_ADDRESS'] = ' temporal:7233 ';
    process.env['PORTARIUM_TEMPORAL_NAMESPACE'] = ' portarium ';
    process.env['PORTARIUM_TEMPORAL_TASK_QUEUE'] = ' runs ';

    const cfg = readTemporalWorkerConfig();
    expect(cfg.address).toBe('temporal:7233');
    expect(cfg.namespace).toBe('portarium');
    expect(cfg.taskQueue).toBe('runs');
  });
});

describe('createTemporalWorker', () => {
  it('connects, creates a worker, and exposes run/shutdown', async () => {
    const sdk = await import('@temporalio/worker');

    const close = vi.fn(async () => undefined);
    vi.mocked(sdk.NativeConnection.connect).mockResolvedValueOnce({ close } as never);

    const shutdown = vi.fn();
    const run = vi.fn(async () => undefined);
    vi.mocked(sdk.Worker.create).mockResolvedValueOnce({ shutdown, run } as never);

    const handle = await createTemporalWorker({
      address: 'temporal:7233',
      namespace: 'default',
      taskQueue: 'portarium-runs',
    });

    await handle.run();
    expect(run).toHaveBeenCalledTimes(1);

    await handle.shutdown();
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
