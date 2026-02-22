/**
 * Extended Approval Lifecycle State Machine (bead-1i3v).
 *
 * Defines the full approval lifecycle with finer-grained states than the
 * original `ApprovalV1` model (Pending → decision).  This model is additive
 * and coexists with `approval-v1.ts`.
 *
 * States:
 *   Open → Assigned → UnderReview → Decided (Approved | Denied | ChangesRequested)
 *                                         ↓                               ↓
 *                                   Executed | Expired           Open (reopened)
 *                                         ↓
 *                                    RolledBack
 *
 * Any state except Executed and RolledBack may also transition to Expired.
 *
 * Each transition produces a domain event (see `ApprovalLifecycleEventKind`).
 * Transitions are deterministic, auditable, and guarded by explicit invariants.
 */

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------

/** All possible states in the extended approval lifecycle. */
export type ApprovalLifecycleStatus =
  | 'Open' //          Created, awaiting assignment
  | 'Assigned' //      Assigned to one or more approvers
  | 'UnderReview' //   Active review in progress
  | 'Approved' //      Decision: approved (pre-execution)
  | 'Denied' //        Decision: denied (terminal)
  | 'ChangesRequested' // Decision: changes needed (blocks progress, can be reopened)
  | 'Executed' //      Approved and execution was recorded
  | 'RolledBack' //    Execution reversed
  | 'Expired'; //      SLA timeout before a terminal decision was reached

/** Decision states — the immediate outcomes of the UnderReview → Decided transition. */
export type ApprovalDecisionStatus = 'Approved' | 'Denied' | 'ChangesRequested';

/** Terminal states — no further transitions are valid. */
export type ApprovalTerminalStatus = 'Denied' | 'RolledBack' | 'Expired';

/** States in which a human approver can still act. */
export type ApprovalActiveStatus = 'Open' | 'Assigned' | 'UnderReview';

// ---------------------------------------------------------------------------
// Compile-time state machine
// ---------------------------------------------------------------------------

/**
 * Maps each lifecycle status to the union of statuses it can legally transition to.
 * `never` for terminal states means no outgoing transitions exist.
 *
 * - Open:              → Assigned | UnderReview | Expired
 * - Assigned:          → UnderReview | Expired
 * - UnderReview:       → Approved | Denied | ChangesRequested | Expired
 * - Approved:          → Executed | Expired
 * - Denied:            (terminal)
 * - ChangesRequested:  → Open  (reopened for revision)
 * - Executed:          → RolledBack
 * - RolledBack:        (terminal)
 * - Expired:           (terminal)
 */
export interface ApprovalLifecycleTransitionMap {
  Open: 'Assigned' | 'UnderReview' | 'Expired';
  Assigned: 'UnderReview' | 'Expired';
  UnderReview: 'Approved' | 'Denied' | 'ChangesRequested' | 'Expired';
  Approved: 'Executed' | 'Expired';
  Denied: never;
  ChangesRequested: 'Open';
  Executed: 'RolledBack';
  RolledBack: never;
  Expired: never;
}

/**
 * The set of valid target states reachable from a given source state.
 * Resolves to `never` for terminal states.
 *
 * Usage:
 *   type Next = ValidApprovalLifecycleTransition<'UnderReview'>;
 *   // => 'Approved' | 'Denied' | 'ChangesRequested' | 'Expired'
 */
export type ValidApprovalLifecycleTransition<
  From extends ApprovalLifecycleStatus = ApprovalLifecycleStatus,
> = ApprovalLifecycleTransitionMap[From];

// ---------------------------------------------------------------------------
// Runtime transition table
// ---------------------------------------------------------------------------

/** Runtime transition table: source → allowed next states. */
export const APPROVAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<ApprovalLifecycleStatus, readonly ApprovalLifecycleStatus[]>
> = {
  Open: ['Assigned', 'UnderReview', 'Expired'],
  Assigned: ['UnderReview', 'Expired'],
  UnderReview: ['Approved', 'Denied', 'ChangesRequested', 'Expired'],
  Approved: ['Executed', 'Expired'],
  Denied: [],
  ChangesRequested: ['Open'],
  Executed: ['RolledBack'],
  RolledBack: [],
  Expired: [],
} as const;

/** States that have no outgoing transitions. */
export const TERMINAL_LIFECYCLE_STATUSES: readonly ApprovalLifecycleStatus[] = [
  'Denied',
  'RolledBack',
  'Expired',
];

// ---------------------------------------------------------------------------
// Compile-time guard (detects regressions if the transition table is edited)
// ---------------------------------------------------------------------------

type _CheckAllStatusesCovered = {
  [K in ApprovalLifecycleStatus]: (typeof APPROVAL_LIFECYCLE_TRANSITIONS)[K];
};

// If this fails to compile, APPROVAL_LIFECYCLE_TRANSITIONS is missing a key.
const _TRANSITION_TABLE_COVERAGE_GUARD: _CheckAllStatusesCovered = APPROVAL_LIFECYCLE_TRANSITIONS;
void _TRANSITION_TABLE_COVERAGE_GUARD;

// ---------------------------------------------------------------------------
// Domain events produced by each transition
// ---------------------------------------------------------------------------

/**
 * The kind of domain event produced by each lifecycle transition.
 * One event kind per logical transition type (not per status pair).
 */
export type ApprovalLifecycleEventKind =
  | 'ApprovalOpened' //           Initial creation (→ Open)
  | 'ApprovalAssigned' //         Open/Assigned → Assigned
  | 'ApprovalUnderReview' //      Assigned/Open → UnderReview
  | 'ApprovalGranted' //          UnderReview → Approved
  | 'ApprovalDenied' //           UnderReview → Denied
  | 'ApprovalChangesRequested' // UnderReview → ChangesRequested
  | 'ApprovalReopened' //         ChangesRequested → Open
  | 'ApprovalExecuted' //         Approved → Executed
  | 'ApprovalRolledBack' //       Executed → RolledBack
  | 'ApprovalExpired'; //         Any active/approved → Expired

/**
 * Maps each (from → to) transition pair to the event kind it produces.
 * Only valid transitions are represented.
 */
export function approvalLifecycleEventKind(
  from: ApprovalLifecycleStatus,
  to: ApprovalLifecycleStatus,
): ApprovalLifecycleEventKind {
  if (to === 'Assigned') return 'ApprovalAssigned';
  if (to === 'UnderReview') return 'ApprovalUnderReview';
  if (to === 'Approved') return 'ApprovalGranted';
  if (to === 'Denied') return 'ApprovalDenied';
  if (to === 'ChangesRequested') return 'ApprovalChangesRequested';
  if (to === 'Open' && from === 'ChangesRequested') return 'ApprovalReopened';
  if (to === 'Executed') return 'ApprovalExecuted';
  if (to === 'RolledBack') return 'ApprovalRolledBack';
  if (to === 'Expired') return 'ApprovalExpired';
  throw new ApprovalLifecycleTransitionError(from, to);
}

// ---------------------------------------------------------------------------
// Transition error
// ---------------------------------------------------------------------------

export class ApprovalLifecycleTransitionError extends Error {
  public override readonly name = 'ApprovalLifecycleTransitionError';
  public readonly from: ApprovalLifecycleStatus;
  public readonly to: ApprovalLifecycleStatus;

  public constructor(from: ApprovalLifecycleStatus, to: ApprovalLifecycleStatus) {
    super(`Invalid approval lifecycle transition: ${from} → ${to}`);
    this.from = from;
    this.to = to;
  }
}

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the transition `from → to` is valid.
 */
export function isValidApprovalLifecycleTransition(
  from: ApprovalLifecycleStatus,
  to: ApprovalLifecycleStatus,
): boolean {
  return APPROVAL_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/**
 * Asserts that the transition `from → to` is valid.
 * Throws `ApprovalLifecycleTransitionError` when the transition is illegal.
 */
export function assertValidApprovalLifecycleTransition(
  from: ApprovalLifecycleStatus,
  to: ApprovalLifecycleStatus,
): void {
  if (!isValidApprovalLifecycleTransition(from, to)) {
    throw new ApprovalLifecycleTransitionError(from, to);
  }
}

/**
 * Returns `true` when `status` is a terminal state (no further transitions).
 */
export function isTerminalApprovalLifecycleStatus(status: ApprovalLifecycleStatus): boolean {
  return TERMINAL_LIFECYCLE_STATUSES.includes(status);
}

/**
 * Returns `true` when `status` is an active state (human action still possible).
 */
export function isActiveApprovalLifecycleStatus(status: ApprovalLifecycleStatus): boolean {
  return status === 'Open' || status === 'Assigned' || status === 'UnderReview';
}

/**
 * Returns `true` when `status` represents a human decision having been recorded.
 */
export function isDecisionApprovalLifecycleStatus(status: ApprovalLifecycleStatus): boolean {
  return status === 'Approved' || status === 'Denied' || status === 'ChangesRequested';
}

// ---------------------------------------------------------------------------
// Structural invariants (for testing + runtime assertions)
// ---------------------------------------------------------------------------

/**
 * Returns all reachable statuses starting from `start` via BFS.
 * Useful for verifying reachability in tests.
 */
export function reachableApprovalLifecycleStatuses(
  start: ApprovalLifecycleStatus,
): Set<ApprovalLifecycleStatus> {
  const visited = new Set<ApprovalLifecycleStatus>();
  const queue: ApprovalLifecycleStatus[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of APPROVAL_LIFECYCLE_TRANSITIONS[current]) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return visited;
}
