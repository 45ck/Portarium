import type { RunStatus } from '../runs/run-v1.js';

export const RUN_STATUS_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  Pending: ['Running'],
  Running: ['Succeeded', 'Failed', 'Cancelled', 'WaitingForApproval', 'Paused'],
  WaitingForApproval: ['Running'],
  Paused: ['Running'],
  Succeeded: [],
  Failed: [],
  Cancelled: [],
} as const;

export const TERMINAL_RUN_STATUSES: readonly RunStatus[] = ['Succeeded', 'Failed', 'Cancelled'];

export class RunStatusTransitionError extends Error {
  public override readonly name = 'RunStatusTransitionError';
  public readonly from: RunStatus;
  public readonly to: RunStatus;

  public constructor(from: RunStatus, to: RunStatus) {
    super(`Invalid run status transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

export function isValidRunStatusTransition(from: RunStatus, to: RunStatus): boolean {
  return RUN_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidRunStatusTransition(from: RunStatus, to: RunStatus): void {
  if (!isValidRunStatusTransition(from, to)) {
    throw new RunStatusTransitionError(from, to);
  }
}

export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

export function terminalRunStatuses(): readonly RunStatus[] {
  return TERMINAL_RUN_STATUSES;
}
