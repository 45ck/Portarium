import { startHealthServer, type HealthServerHandle } from './health-server.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { createLogger } from '../../infrastructure/observability/logger.js';

const log = createLogger('control-plane');

export type ControlPlaneRuntimeOptions = Readonly<{
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

export async function main(options: ControlPlaneRuntimeOptions = {}): Promise<HealthServerHandle> {
  const role =
    process.env['PORTARIUM_CONTAINER_ROLE'] ?? process.env['PORTARIUM_ROLE'] ?? 'control-plane';
  const port = options.port ?? readPort(8080);
  const host = options.host ?? '0.0.0.0';

  const handle = await startHealthServer({
    role,
    host,
    port,
    handler: createControlPlaneHandler(),
  });

  log.info('Portarium server started', { role, host: handle.host, port: handle.port });

  const shutdown = async () => {
    await handle.close();
    // Avoid forced process termination so test runners/coverage can flush cleanly.
    process.exitCode = 0;
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  return handle;
}

// Only auto-run when this file is the Node entrypoint.
// (Vitest imports should not start a listening server by default.)
const argv1 = process.argv[1];
if (argv1 && import.meta.url === pathToFileURL(resolve(argv1)).href) void main();
