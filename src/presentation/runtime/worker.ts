import { startHealthServer, type HealthServerHandle } from './health-server.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTemporalWorker } from '../../infrastructure/temporal/temporal-worker.js';

export type WorkerRuntimeOptions = Readonly<{
  port?: number;
  host?: string;
}>;

function readPort(defaultPort: number): number {
  const raw = process.env['PORTARIUM_HTTP_PORT'] ?? process.env['PORTARIUM_PORT'];
  if (!raw) return defaultPort;
  const parsed = Number(raw);
  // Allow port 0 for tests/local usage (OS-assigned ephemeral port).
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultPort;
}

export async function main(options: WorkerRuntimeOptions = {}): Promise<HealthServerHandle> {
  const role =
    process.env['PORTARIUM_CONTAINER_ROLE'] ?? process.env['PORTARIUM_ROLE'] ?? 'execution-plane';
  const port = options.port ?? readPort(8081);
  const host = options.host ?? '0.0.0.0';

  const handle = await startHealthServer({ role, host, port });

  console.log(`Portarium ${role} listening on ${handle.host}:${handle.port}`);

  const enableTemporalWorker = (() => {
    const raw = process.env['PORTARIUM_ENABLE_TEMPORAL_WORKER'];
    if (!raw) return false;
    const v = raw.trim().toLowerCase();
    return v !== '' && v !== '0' && v !== 'false' && v !== 'no' && v !== 'off';
  })();

  const temporal = enableTemporalWorker ? await createTemporalWorker() : null;
  const temporalRunPromise =
    temporal !== null
      ? temporal
          .run()
          .then(() => {
            console.log('Temporal worker stopped.');
          })
          .catch((error) => {
            console.error('Temporal worker crashed.', error);
            process.exitCode = 1;
          })
      : null;

  if (temporal !== null) {
    console.log(
      `Temporal worker started (namespace=${temporal.config.namespace}, taskQueue=${temporal.config.taskQueue}).`,
    );
  }

  const shutdown = async () => {
    if (temporal !== null) {
      await temporal.shutdown();
      await temporalRunPromise;
    }
    await handle.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  return handle;
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(resolve(argv1)).href) void main();
