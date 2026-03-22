import { randomUUID } from 'node:crypto';

import {
  startHealthServer,
  type HealthServerHandle,
  type ReadinessResult,
} from './health-server.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createControlPlaneHandler } from './control-plane-handler.js';
import { buildControlPlaneDeps } from './control-plane-handler.bootstrap.js';
import { createLogger } from '../../infrastructure/observability/logger.js';
import { initializeOtel } from '../../infrastructure/observability/otel-setup.js';
import {
  createApprovalExpiryScheduler,
  type InfraApprovalExpirySchedulerOptions,
} from '../../infrastructure/scheduler/approval-expiry-scheduler.js';
import type { ApprovalSchedulerPort } from '../../application/ports/approval-scheduler.js';
import type { EventPublisher } from '../../application/ports/event-publisher.js';

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
 * Start the approval expiry/escalation scheduler if an approval store and
 * query store are available and the feature is not explicitly disabled.
 *
 * Uses the full-lifecycle sweep commands that persist transitions and
 * publish CloudEvents, replacing the earlier no-op evaluation-only path.
 */
function tryStartApprovalScheduler(
  deps: Awaited<ReturnType<typeof buildControlPlaneDeps>>,
): ApprovalSchedulerPort | null {
  if (process.env['PORTARIUM_APPROVAL_SCHEDULER_DISABLED'] === 'true') return null;
  if (!deps.approvalQueryStore || !deps.approvalStore) return null;

  const systemWorkspaceId = process.env['PORTARIUM_SYSTEM_WORKSPACE_ID']?.trim();
  if (!systemWorkspaceId) {
    log.warn('Approval scheduler not started: PORTARIUM_SYSTEM_WORKSPACE_ID is not set.');
    return null;
  }

  const rawInterval = Number(process.env['PORTARIUM_APPROVAL_SCHEDULER_INTERVAL_MS'] ?? '60000');
  const intervalMs = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : 60_000;

  // Use the event publisher from deps if available, otherwise fall back to a
  // logging-only publisher that records events for observability but does not
  // push to an external bus. This ensures the sweep commands always have a
  // valid publisher to call.
  const eventPublisher: EventPublisher = deps.eventPublisher ?? {
    publish: async (event) => {
      log.info('Approval scheduler event (no publisher configured)', {
        type: event.type,
        subject: event.subject,
      });
    },
  };

  const options: InfraApprovalExpirySchedulerOptions = {
    deps: {
      approvalStore: deps.approvalStore,
      approvalQueryStore: deps.approvalQueryStore,
      clock: { nowIso: () => new Date().toISOString() },
      idGenerator: { generateId: () => randomUUID() },
      eventPublisher,
      ...(deps.evidenceLog ? { evidenceLog: deps.evidenceLog } : {}),
    },
    config: {
      intervalMs,
      workspaceId: systemWorkspaceId,
      correlationIdPrefix: 'approval-scheduler',
    },
    onSweep: (result) => {
      if (result.expiredCount > 0 || result.escalatedCount > 0) {
        log.info('Approval scheduler sweep', {
          evaluated: result.evaluated,
          escalated: result.escalatedCount,
          expired: result.expiredCount,
        });
      }
    },
    onError: (error) => {
      log.warn('Approval scheduler sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  };

  const scheduler = createApprovalExpiryScheduler(options);
  scheduler.start();

  log.info('Approval scheduler started', { intervalMs });
  return scheduler;
}

export async function main(options: ControlPlaneRuntimeOptions = {}): Promise<HealthServerHandle> {
  initializeOtel();
  const role =
    process.env['PORTARIUM_CONTAINER_ROLE'] ?? process.env['PORTARIUM_ROLE'] ?? 'control-plane';
  const port = options.port ?? readPort(8080);
  const host = options.host ?? '0.0.0.0';

  const deps = await buildControlPlaneDeps();

  const readinessCheck = async (): Promise<ReadinessResult> => {
    const checks: Record<string, { ok: boolean; message?: string }> = {};

    // Check workspace store (exercises the primary DB connection)
    if (deps.workspaceStore) {
      try {
        // A lightweight read that exercises the DB connection without side effects.
        await deps.workspaceStore.getWorkspaceById(
          '__readiness_probe__' as never,
          '__readiness_probe__' as never,
        );
        checks['database'] = { ok: true };
      } catch (error: unknown) {
        checks['database'] = {
          ok: false,
          message: error instanceof Error ? error.message : 'DB check failed',
        };
      }
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    return { ok: allOk, checks };
  };

  const handle = await startHealthServer({
    role,
    host,
    port,
    handler: createControlPlaneHandler(deps),
    readinessCheck,
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
