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
 */
export function startApprovalScheduler(
  deps: ApprovalExpirySchedulerDeps,
  ctx: SchedulerContext,
  intervalMs = DEFAULT_INTERVAL_MS,
  onSweep?: SweepCallback,
): SchedulerHandle {
  let timer: ReturnType<typeof setInterval> | null = null;

  const runSweep = async (): Promise<void> => {
    const result = await evaluatePendingApprovals(deps, ctx);
    if (onSweep) {
      onSweep(result);
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
