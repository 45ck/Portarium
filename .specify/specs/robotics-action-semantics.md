# Robotics Action Semantics

## Purpose

Define workflow action semantics for `RoboticsActuation` so physical actions are safe, retryable, and auditable.

## Scope

- Workflow actions that map to robotics capabilities:
  - `robot:execute_action`
  - `robot:cancel_action`
  - `robot:stop`
  - `robot:estop_request`
- Mission dispatch and action lifecycle signalling between control plane and edge gateway.

## Semantics

### 1) Pre-emption

- Long-running mission actions MUST expose a cancellation path.
- `robot:execute_action` requests MUST set `supportsPreemption: true`.
- Cancellation is represented by `robot:cancel_action` with the same mission/action correlation.
- Pre-emption requests move in-flight mission work to a waiting/pre-empted state until resumed or terminated.

### 2) Stop-path bypass

- `robot:stop` and `robot:estop_request` are stop-path actions.
- Stop-path actions MUST set `bypassTierEvaluation: true`.
- Stop-path actions bypass normal execution-tier policy evaluation in the control-plane action path.
- Edge safety controller remains final authority for physical stop timing and enforcement (see ADR-0067).

### 3) Retry policy and idempotency

- Physical mission actions (`robot:execute_action`, `robot:cancel_action`) MUST include explicit `idempotencyKey`.
- Duplicate command submissions with same mission + action + idempotency key MUST deduplicate.
- Stop-path actions are treated as safety-priority signals and do not require idempotency keys.

### 4) Manual-only completion

- Some mission actions require operator field confirmation before the action can be marked `Succeeded`.
- If completion mode is `ManualOnly`, `requiresOperatorConfirmation` MUST be `true`.
- Manual-only completion requires an operator completion signal payload including:
  - mission correlation
  - action execution correlation
  - operator identity
  - completion outcome (`Succeeded` or `Failed`)
  - confirmation timestamp

## Contract surfaces

- Domain parser/value-object module: `src/domain/robots/mission-action-semantics-v1.ts`
- Application port contract: `src/application/ports/mission-port.ts`

## Validation requirements

- Parser-level validation MUST reject:
  - Missing idempotency key for physical actions.
  - Stop-path actions without bypass flag.
  - `robot:execute_action` without pre-emption support.
  - `ManualOnly` completion without operator confirmation requirement.

