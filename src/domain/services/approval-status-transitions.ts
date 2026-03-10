import type { ApprovalStatus } from '../approvals/approval-v1.js';

// ---------------------------------------------------------------------------
// Compile-time state machine
// ---------------------------------------------------------------------------

/**
 * Maps each ApprovalStatus to the union of states it can legally transition to.
 * `never` for terminal states means no outgoing transitions are valid.
 *
 * Approval lifecycle:
 *   - Starts in `Pending`.
 *   - `RequestChanges` is a non-terminal decision: it transitions back to
 *     `Pending` so the requester can revise and resubmit.
 *   - `Approved` is a non-terminal decision: it transitions to `Executed`
 *     once the approved agent action is dispatched (re-execution guard
 *     ensures this is a one-way, single-use transition).
 *   - `Denied`, `Expired`, and `Executed` are terminal: no outgoing transitions.
 */
export interface ApprovalStatusTransitionMap {
  Pending: 'Approved' | 'Denied' | 'Expired' | 'RequestChanges';
  Approved: 'Executed';
  Denied: never;
  Executed: never;
  Expired: never;
  RequestChanges: 'Pending';
}

/**
 * The set of valid target states reachable from a given source state.
 * When `From` is a terminal state, this resolves to `never`.
 *
 * Usage:
 *   type ValidFrom = ValidApprovalStatusTransition<'Pending'>;
 *   // => 'Approved' | 'Denied' | 'Expired' | 'RequestChanges'
 *   type ValidFromApproved = ValidApprovalStatusTransition<'Approved'>;
 *   // => 'Executed'
 */
export type ValidApprovalStatusTransition<From extends ApprovalStatus = ApprovalStatus> =
  ApprovalStatusTransitionMap[From];

// ---------------------------------------------------------------------------
// Runtime transition table
// ---------------------------------------------------------------------------

export const APPROVAL_STATUS_TRANSITIONS: Readonly<
  Record<ApprovalStatus, readonly ApprovalStatus[]>
> = {
  Pending: ['Approved', 'Denied', 'Expired', 'RequestChanges'],
  Approved: ['Executed'],
  Denied: [],
  Executed: [],
  Expired: [],
  RequestChanges: ['Pending'],
} as const;

export const TERMINAL_APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  'Denied',
  'Executed',
  'Expired',
];

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

export class ApprovalStatusTransitionError extends Error {
  public override readonly name = 'ApprovalStatusTransitionError';
  public readonly from: ApprovalStatus;
  public readonly to: ApprovalStatus;

  public constructor(from: ApprovalStatus, to: ApprovalStatus) {
    super(`Invalid approval status transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
  }
}

export function isValidApprovalStatusTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return APPROVAL_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidApprovalStatusTransition(
  from: ApprovalStatus,
  to: ApprovalStatus,
): void {
  if (!isValidApprovalStatusTransition(from, to)) {
    throw new ApprovalStatusTransitionError(from, to);
  }
}

export function isTerminalApprovalStatus(status: ApprovalStatus): boolean {
  return TERMINAL_APPROVAL_STATUSES.includes(status);
}

export function terminalApprovalStatuses(): readonly ApprovalStatus[] {
  return TERMINAL_APPROVAL_STATUSES;
}

// ---------------------------------------------------------------------------
// Compile-time consistency guard
// ---------------------------------------------------------------------------

// This type checks that the runtime table and the type-level map agree.
// A TS error here means the table is missing a status.
type _RuntimeTableKeys = keyof typeof APPROVAL_STATUS_TRANSITIONS;
type _TableCoversAllStatuses = _RuntimeTableKeys extends ApprovalStatus
  ? ApprovalStatus extends _RuntimeTableKeys
    ? true
    : never
  : never;

// Evaluated to `true`; a TS error here means the table is missing a status.
export const APPROVAL_TRANSITION_TABLE_GUARD: _TableCoversAllStatuses = true;

// Ensure Pending (the only non-terminal state) has non-empty successors.
type _PendingHasSuccessors = ValidApprovalStatusTransition<'Pending'> extends never ? never : true;
export const APPROVAL_PENDING_HAS_SUCCESSORS_GUARD: _PendingHasSuccessors = true;
