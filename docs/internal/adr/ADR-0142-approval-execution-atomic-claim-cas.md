# ADR-0142: Approval Execution Atomic Claim CAS

## Status

Accepted

## Context

ADR-0118 defined approved agent-action execution as a single-use transition from
`Approved` to `Executed`. Bead-1139 added stable idempotency keys and replay
protection, but two simultaneous first submissions could still both read
`Approved` before either persisted `Executed`.

That gap matters because external dispatch is effectful. The control plane must
ensure only one caller can leave the approval boundary and invoke the execution
plane.

## Decision

Approval decision writes and approved action execution use storage-level
compare-and-set semantics.

- Human approval decisions update `Pending` to the submitted terminal decision
  only when the stored approval is still `Pending`.
- Approved agent-action execution first claims `Approved -> Executing` before
  dispatch.
- Only the claim winner may call `ActionRunnerPort.dispatchAction`.
- Successful dispatch finalizes `Executing -> Executed`.
- Dispatch failure before accepted external side effect releases
  `Executing -> Approved` and records the failure event/evidence.
- Claim losers return conflict or idempotency replay and must not dispatch,
  publish duplicate events, append duplicate evidence, or overwrite approval
  state.

The claim is short-lived. The system must not hold a database transaction open
while waiting for external dispatch.

## Amendment: Durable Execution Reservation

Bead-1141 extends the claim with a durable idempotency reservation keyed by the
same execution key used for downstream dispatch.

- Before dispatch, the command records an `InProgress` reservation containing a
  canonical request fingerprint and lease expiry metadata.
- A retry with the same fingerprint while the reservation is active returns an
  `Executing` response and must not dispatch again.
- A retry with a different fingerprint returns `Conflict`.
- Terminal execution results complete the reservation and replay from it.
- If the approval claim cannot be won after a reservation is started, the
  reservation is released so the caller is not stranded behind a failed local
  claim.
- A stale `Executing` approval or stale `InProgress` reservation is recovery
  work, not permission to automatically release to `Approved`; duplicate
  external side effects are worse than requiring operator/reconciler review.

## Consequences

This closes concurrent first-writer races for approval decisions and approved
action execution. The durable reservation closes the immediate retry-after-crash
gap by making retries observe `Executing` instead of dispatching again. Full
reconciliation after an ambiguous external acceptance still relies on the stable
downstream `ActionId` and `Idempotency-Key` from bead-1139.

This ADR extends ADR-0118, ADR-0069, and ADR-0101.
