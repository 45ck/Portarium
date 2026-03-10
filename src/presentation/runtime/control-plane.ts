import { randomUUID } from 'node:crypto';

import { startHealthServer, type HealthServerHandle } from './health-server.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { buildControlPlaneDeps } from './control-plane-handler.bootstrap.js';
import { createLogger } from '../../infrastructure/observability/logger.js';
import { initializeOtel } from '../../infrastructure/observability/otel-setup.js';
import { CorrelationId, WorkspaceId } from '../../domain/primitives/index.js';
import {
  startApprovalScheduler,
  type SchedulerHandle,
} from '../../application/services/approval-scheduler-runner.js';

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

/**
 * Start the approval expiry/escalation scheduler if an approval query store
 * is available and the feature is not explicitly disabled.
 */
function tryStartApprovalScheduler(
  deps: ReturnType<typeof buildControlPlaneDeps>,
): SchedulerHandle | null {
  if (process.env['PORTARIUM_APPROVAL_SCHEDULER_DISABLED'] === 'true') return null;
  if (!deps.approvalQueryStore) return null;

  const systemWorkspaceId = process.env['PORTARIUM_SYSTEM_WORKSPACE_ID']?.trim();
  if (!systemWorkspaceId) {
    log.warn('Approval scheduler not started: PORTARIUM_SYSTEM_WORKSPACE_ID is not set.');
    return null;
  }

  const rawInterval = Number(process.env['PORTARIUM_APPROVAL_SCHEDULER_INTERVAL_MS'] ?? '60000');
  const intervalMs = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 60_000;

  const handle = startApprovalScheduler(
    {
      approvalQueryStore: deps.approvalQueryStore,
      clock: { nowIso: () => new Date().toISOString() },
      idGenerator: { generateId: () => randomUUID() },
    },
    {
      tenantId: WorkspaceId(systemWorkspaceId),
      workspaceId: WorkspaceId(systemWorkspaceId),
      correlationId: CorrelationId(`approval-scheduler-${randomUUID()}`),
    },
    intervalMs,
    (result) => {
      // TODO(bead-XXXX): Wire scheduler actions to EventPublisher for
      // ApprovalExpired/ApprovalEscalated event publishing. Currently
      // the scheduler evaluates state but does not persist transitions.
      // This is safe — the scheduler is read-only and events will be
      // published once the full lifecycle integration is implemented.
      if (result.actions.length > 0) {
        log.info('Approval scheduler sweep', {
          evaluated: result.evaluated,
          escalated: result.actions.filter((a) => a.kind === 'escalated').length,
          expired: result.actions.filter((a) => a.kind === 'expired').length,
        });
      }
    },
    (error) => {
      log.warn('Approval scheduler sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );

  log.info('Approval scheduler started', { intervalMs });
  return handle;
}

export async function main(options: ControlPlaneRuntimeOptions = {}): Promise<HealthServerHandle> {
  initializeOtel();
  const role =
    process.env['PORTARIUM_CONTAINER_ROLE'] ?? process.env['PORTARIUM_ROLE'] ?? 'control-plane';
  const port = options.port ?? readPort(8080);
  const host = options.host ?? '0.0.0.0';

  const deps = buildControlPlaneDeps();

  const handle = await startHealthServer({
    role,
    host,
    port,
    handler: createControlPlaneHandler(deps),
  });

  const schedulerHandle = tryStartApprovalScheduler(deps);

  log.info('Portarium server started', { role, host: handle.host, port: handle.port });

  const shutdown = async () => {
    schedulerHandle?.stop();
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
