import { startHealthServer, type HealthServerHandle } from './health-server.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type WorkerRuntimeOptions = Readonly<{
  port?: number;
  host?: string;
}>;

function readPort(defaultPort: number): number {
  const raw = process.env['PORTARIUM_HTTP_PORT'] ?? process.env['PORTARIUM_PORT'];
  if (!raw) return defaultPort;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPort;
}

export async function main(options: WorkerRuntimeOptions = {}): Promise<HealthServerHandle> {
  const role =
    process.env['PORTARIUM_CONTAINER_ROLE'] ?? process.env['PORTARIUM_ROLE'] ?? 'execution-plane';
  const port = options.port ?? readPort(8081);
  const host = options.host ?? '0.0.0.0';

  const handle = await startHealthServer({ role, host, port });

  // This is a placeholder for the execution-plane worker loop (Temporal, adapters).
  console.log(`Portarium ${role} listening on ${handle.host}:${handle.port}`);

  const shutdown = async () => {
    await handle.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  return handle;
}

const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(resolve(argv1)).href) void main();
