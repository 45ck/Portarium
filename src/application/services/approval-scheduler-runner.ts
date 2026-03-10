/**
 * Approval Scheduler Runner (bead-0910).
 *
 * Wraps the evaluation logic in a periodic runner using setInterval.
 * Returns a handle with start/stop for graceful lifecycle management.
 */

import {
  evaluatePendingApprovals,
  type ApprovalExpirySchedulerDeps,
  type EvaluatePendingResult,
  type SchedulerContext,
} from './approval-expiry-scheduler.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SchedulerHandle = Readonly<{
  /** Stop the periodic scheduler (idempotent). */
  stop: () => void;
}>;

export type SweepCallback = (result: EvaluatePendingResult) => void;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Start a periodic approval expiry/escalation scheduler.
 *
 * @param deps       - Service dependencies (store, clock, id generator).
 * @param ctx        - Scheduler context (tenant, workspace, correlation).
 * @param intervalMs - Sweep interval in milliseconds (default 60s).
 * @param onSweep    - Optional callback invoked after each sweep with results.
 * @param onError    - Optional callback for sweep errors (observability). If not
 *                     provided, errors are silently swallowed to keep the scheduler alive.
 */
export function startApprovalScheduler(
  deps: ApprovalExpirySchedulerDeps,
  ctx: SchedulerContext,
  intervalMs = DEFAULT_INTERVAL_MS,
  onSweep?: SweepCallback,
  onError?: (error: unknown) => void,
): SchedulerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let sweeping = false;

  const runSweep = async (): Promise<void> => {
    if (sweeping) return;
    sweeping = true;
    try {
      const result = await evaluatePendingApprovals(deps, ctx);
      if (onSweep) {
        onSweep(result);
      }
    } catch (error: unknown) {
      // Scheduler must be resilient to transient failures (e.g. store
      // unavailable). Swallow the error so the next interval still fires.
      // Callers can supply `onError` for observability; there is intentionally
      // no hard dependency on a logger in the application layer.
      if (onError) {
        onError(error);
      }
    } finally {
      sweeping = false;
    }
  };

  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);

  return {
    stop: () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
