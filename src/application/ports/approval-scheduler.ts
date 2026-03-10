/**
 * Approval Scheduler Port (bead-0910).
 *
 * Defines the interface for a periodic approval expiry and escalation
 * scheduler. Infrastructure adapters implement this to provide
 * interval-based sweep execution.
 */

export interface ApprovalSchedulerPort {
  /** Start the periodic scheduler. */
  start(): void;

  /** Stop the periodic scheduler (idempotent). */
  stop(): void;

  /** Whether the scheduler is currently running. */
  isRunning(): boolean;
}
