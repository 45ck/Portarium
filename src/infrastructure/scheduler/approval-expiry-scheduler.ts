/**
 * Infrastructure: Approval Expiry Scheduler (bead-0910).
 *
 * Interval-based scheduler that periodically calls the sweep-expired-approvals
 * command. Implements the ApprovalSchedulerPort for lifecycle management.
 *
 * Configuration:
 *  - intervalMs: sweep interval (default 60_000ms / 1 minute)
 *  - workspaceId: the workspace to sweep
 *  - correlationId: correlation ID for all sweep operations
 *
 * The scheduler silently catches errors from individual sweep runs to
 * prevent a single failure from stopping the periodic cycle.
 */

import type { ApprovalSchedulerPort } from '../../application/ports/approval-scheduler.js';
import {
  sweepExpiredApprovals,
  type SweepExpiredApprovalsDeps,
  type SweepExpiredApprovalsOutput,
} from '../../application/commands/sweep-expired-approvals.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApprovalExpirySchedulerConfig = Readonly<{
  /** Sweep interval in milliseconds. Default: 60_000 (1 minute). */
  intervalMs?: number;
  /** Workspace to sweep. */
  workspaceId: string;
  /** Correlation ID prefix for sweep operations. */
  correlationIdPrefix?: string;
}>;

export type SweepResultCallback = (result: SweepExpiredApprovalsOutput) => void;
export type SweepErrorCallback = (error: unknown) => void;

export type InfraApprovalExpirySchedulerOptions = Readonly<{
  deps: SweepExpiredApprovalsDeps;
  config: ApprovalExpirySchedulerConfig;
  onSweep?: SweepResultCallback;
  onError?: SweepErrorCallback;
}>;

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_CORRELATION_PREFIX = 'scheduler-sweep';

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createApprovalExpiryScheduler(
  options: InfraApprovalExpirySchedulerOptions,
): ApprovalSchedulerPort {
  const { deps, config, onSweep, onError } = options;
  const intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
  const correlationPrefix = config.correlationIdPrefix ?? DEFAULT_CORRELATION_PREFIX;

  let timer: ReturnType<typeof setInterval> | null = null;
  let sweepCounter = 0;

  const runSweep = async (): Promise<void> => {
    sweepCounter++;
    const correlationId = `${correlationPrefix}-${String(sweepCounter)}`;

    try {
      const result = await sweepExpiredApprovals(deps, {
        workspaceId: config.workspaceId,
        correlationId,
      });

      if (onSweep) {
        onSweep(result);
      }
    } catch (error: unknown) {
      if (onError) {
        onError(error);
      }
    }
  };

  return {
    start(): void {
      if (timer !== null) return; // already running
      timer = setInterval(() => {
        void runSweep();
      }, intervalMs);
    },

    stop(): void {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    isRunning(): boolean {
      return timer !== null;
    },
  };
}
