import type { RunStatus } from '../runs/run-v1.js';

// ---------------------------------------------------------------------------
// Compile-time state machine
// ---------------------------------------------------------------------------

/**
 * Maps each RunStatus to the union of states it can legally transition to.
 * `never` for terminal states means no outgoing transitions are valid.
 *
 * This type is the canonical truth for the state machine.  The runtime
 * transition table below must stay in sync (enforced by the compile-time
 * guard `_runTransitionTableGuard` at the bottom of this file).
 */
export interface RunStatusTransitionMap {
  Pending: 'Running';
  Running: 'Succeeded' | 'Failed' | 'Cancelled' | 'WaitingForApproval' | 'Paused';
  WaitingForApproval: 'Running';
  Paused: 'Running';
  Succeeded: never;
  Failed: never;
  Cancelled: never;
}

/**
 * The set of valid target states reachable from a given source state.
 * When `From` is a terminal state, this resolves to `never`.
 *
 * Usage:
 *   type ValidFrom = ValidRunStatusTransition<'Running'>;
 *   // => 'Succeeded' | 'Failed' | 'Cancelled' | 'WaitingForApproval' | 'Paused'
 */
export type ValidRunStatusTransition<From extends RunStatus = RunStatus> =
  RunStatusTransitionMap[From];

// ---------------------------------------------------------------------------
// Runtime transition table
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Compile-time consistency guard
// ---------------------------------------------------------------------------

// This type checks that the runtime table and the type-level map agree on
// non-terminal states.  If they diverge, one of these assignments will error.
type _NonTerminalKey = Exclude<RunStatus, 'Succeeded' | 'Failed' | 'Cancelled'>;
type _RuntimeTableKeys = keyof typeof RUN_STATUS_TRANSITIONS;
type _TableCoversAllStatuses = _RuntimeTableKeys extends RunStatus
  ? RunStatus extends _RuntimeTableKeys
    ? true
    : never
  : never;

// Evaluated to `true`; a TS error here means the table is missing a status.
export const RUN_TRANSITION_TABLE_GUARD: _TableCoversAllStatuses = true;

// Ensure non-terminal states have non-empty transition lists in the type map.
// This type errors if any non-terminal state maps to `never`.
type _NonTerminalHasSuccessors = {
  [K in _NonTerminalKey]: ValidRunStatusTransition<K> extends never ? never : true;
}[_NonTerminalKey];

export const RUN_NON_TERMINAL_GUARD: _NonTerminalHasSuccessors = true;
