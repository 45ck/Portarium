# Workflow Action Execution Semantics v1

**Beads:** bead-0425, bead-0433

## Purpose

Define deterministic runtime semantics for workflow action execution so orchestration and worker implementations have no ambiguity for:

- sequential vs parallel branching,
- per-action retry and timeout behavior,
- manual-only completion signaling, and
- compensation hook invocation.

## Scope

This specification governs action execution for `WorkflowV1` runs and applies to Temporal workflow workers and any equivalent orchestrator implementation.

## 1) Execution Graph Semantics

### 1.1 Sequential baseline

- `WorkflowV1.actions` are an ordered list with contiguous `order` values starting at `1`.
- If no branch metadata is present, actions execute strictly sequentially by ascending `order`.
- The next action becomes eligible only after the current action reaches a terminal action state (`Succeeded`, `Failed`, `Cancelled`).

### 1.2 Parallel branch semantics

- Parallel execution is allowed only when an explicit dependency graph is provided by runtime metadata (for example, action dependency edges resolved from workflow definition extensions).
- A parallel branch node becomes runnable when all declared predecessors are `Succeeded`.
- If multiple actions are runnable at the same time, dispatch order MUST be deterministic:
  - primary key: `order` ascending
  - tiebreaker: `actionId` lexical ascending
- Join behavior is `all-of`: downstream actions start only after all required predecessor actions are `Succeeded`.

### 1.3 Failure behavior across branches

- Fail-fast applies by default:
  - on non-retryable failure of any in-flight action, no new actions are scheduled;
  - running actions may finish or be cancelled according to adapter capability.
- After fail-fast, compensation handling (section 4) determines rollback behavior.

## 2) Action Lifecycle

Each action transitions through this lifecycle:

1. `Pending`
2. `Running`
3. terminal:
   - `Succeeded`, or
   - `Failed`, or
   - `Cancelled`, or
   - `WaitingForManualCompletion` (only for manual-only completion flow)

Rules:

- `Pending -> Running` only when scheduler eligibility is satisfied.
- `Running -> Succeeded|Failed|Cancelled` is single-shot and terminal for automated actions.
- `Running -> WaitingForManualCompletion` is allowed only when action completion mode is manual.
- `WaitingForManualCompletion -> Succeeded|Failed|Cancelled` requires a valid manual completion signal (section 3).

## 3) Retry, Timeout, and Manual Completion Signals

### 3.1 Retry policy

Per action, retry policy fields are interpreted as:

- `maxAttempts`: total attempts including the first execution (default `3`, minimum `1`, maximum `10`)
- `initialBackoffMs`: delay before first retry (default `1000`)
- `backoffMultiplier`: exponential factor (default `2.0`)
- `maxBackoffMs`: per-attempt delay cap (default `30000`)
- `retryableErrors`: error classes considered retryable

Retry decision:

- Retryable errors: `timeout`, `rate_limit`, transient `5xx`, transport failures.
- Non-retryable errors: validation failures, policy deny, auth deny, and explicit business conflicts.
- Unknown errors are treated as retryable until `maxAttempts` is exhausted.

### 3.2 Timeout policy

- Each action execution attempt has an attempt timeout (`timeoutMs`).
- Default `timeoutMs` is `300000` (5 minutes) unless overridden.
- On timeout:
  - attempt result is `timeout`;
  - retry decision uses the same retry policy;
  - when attempts are exhausted, action transitions to `Failed`.

### 3.3 Manual-only completion signal contract

Manual completion signal payload:

- `schemaVersion`: `1`
- `runId`
- `actionId`
- `completionToken` (opaque token generated when entering `WaitingForManualCompletion`)
- `outcome`: `Succeeded | Failed | Cancelled`
- `actorUserId`
- `completedAtIso`
- `notes?`
- `evidenceRefs?` (array of evidence IDs/refs)

Validation requirements:

- Signal is accepted only when the action is in `WaitingForManualCompletion`.
- `completionToken` must match the open manual action token.
- Signal handling is idempotent on `(runId, actionId, completionToken)`.
- SoD/policy checks must run before accepting the signal transition.

## 4) Compensation Hook Interface

Compensation is triggered when a run fails after at least one side-effecting action succeeded.

Compensation metadata fields and per-family compensation contracts are defined in:

- `.specify/specs/saga-compensation-interface-v1.md`

Compensation hook contract:

- `compensationOperation`: operation key to invoke for rollback/reversal
- `compensationInput`: JSON payload required by the compensating operation
- `idempotencyKey`: deterministic key (`runId:actionId:compensate`)
- `timeoutMs?`: optional hook timeout override

Execution rules:

- Compensation order is reverse completion order of successfully completed actions.
- Each compensation hook uses retry policy with defaults:
  - `maxAttempts = 2`
  - `initialBackoffMs = 1000`
  - `backoffMultiplier = 2.0`
  - `maxBackoffMs = 10000`
- Compensation is best-effort for all eligible actions; failure in one compensation does not skip remaining hooks.
- Final run outcome:
  - `Failed` with compensation summary attached to evidence/logs.

## 5) Determinism and Auditability

- Action idempotency key MUST remain stable across retries.
- Scheduler decisions must be deterministic for equivalent input state.
- Every attempt and terminal transition must produce evidence with:
  - `runId`, `actionId`, `attempt`,
  - timing (`startedAtIso`, `endedAtIso`),
  - outcome and error classification,
  - correlation metadata.

## 6) Implementation References

- Workflow schema: `.specify/specs/workflow-v1.md`
- Run schema: `.specify/specs/run-v1.md`
- Robotics manual completion constraints: `.specify/specs/robotics-action-semantics.md`
- Plan/effects model: `.specify/specs/plan-v1.md`
