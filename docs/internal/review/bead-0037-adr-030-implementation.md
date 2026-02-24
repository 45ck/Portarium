# bead-0037 ADR-0030 implementation: quota-aware execution primitives

## Implemented scope

- Added orchestration scheduling primitive in application layer:
  - `scheduleQuotaAwareDispatchV1` in `src/application/services/quota-aware-execution.ts`
  - Applies per-minute and daily-cap checks and returns deterministic `DispatchNow` or `Deferred` (`RateLimit`/`DailyCap`) with `retryAtIso`.
- Added adapter call wrapper primitive:
  - `invokeMachineWithQuotaRetryV1` in `src/application/services/quota-aware-execution.ts`
  - Retries only `RateLimited` failures with bounded retry budget.
  - Uses `retryAfterMs` override when available; otherwise bounded exponential backoff + jitter.
  - Returns observability fields: attempts, retry budget used/remaining, backoff history.

## Tests added

- `src/application/services/quota-aware-execution.test.ts`
  - scheduling under limits
  - defer on per-minute exhaustion
  - defer on daily-cap exhaustion
  - 429 retry/backoff success path
  - retryAfter override path
  - bounded retry budget exhaustion
  - non-rate-limited failure is not retried

## Spec updates

- `.specify/specs/quota-semantics-v1.md`
  - Added runtime primitive expectations for scheduling and bounded adapter retries.

## Verification

- Targeted tests pass.
- `npm run -s typecheck` passes.
- Full `ci:pr` blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
