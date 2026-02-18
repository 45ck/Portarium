import { NativeConnection, Worker } from '@temporalio/worker';
import { createRequire } from 'node:module';

import {
  DEFAULT_TEMPORAL_NAMESPACE,
  DEFAULT_TEMPORAL_TASK_QUEUE,
} from './temporal-workflow-orchestrator.js';

export type TemporalWorkerConfig = Readonly<{
  address: string;
  namespace: string;
  taskQueue: string;
}>;

export type TemporalWorkerHandle = Readonly<{
  config: TemporalWorkerConfig;
  shutdown: () => Promise<void>;
  run: () => Promise<void>;
}>;

function readEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return value === '' ? undefined : value;
}

export function readTemporalWorkerConfig(): TemporalWorkerConfig {
  return {
    address: readEnv('PORTARIUM_TEMPORAL_ADDRESS') ?? '127.0.0.1:7233',
    namespace: readEnv('PORTARIUM_TEMPORAL_NAMESPACE') ?? DEFAULT_TEMPORAL_NAMESPACE,
    taskQueue: readEnv('PORTARIUM_TEMPORAL_TASK_QUEUE') ?? DEFAULT_TEMPORAL_TASK_QUEUE,
  };
}

export async function createTemporalWorker(
  config: TemporalWorkerConfig = readTemporalWorkerConfig(),
): Promise<TemporalWorkerHandle> {
  const require = createRequire(import.meta.url);
  const workflowsPath = require.resolve('./workflows.js');

  const connection = await NativeConnection.connect({ address: config.address });
  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    workflowsPath,
  });

  return {
    config,
    shutdown: async () => {
      // Temporal worker shutdown is graceful; run() resolves afterwards.
      worker.shutdown();
      await connection.close();
    },
    run: () => worker.run(),
  };
}
