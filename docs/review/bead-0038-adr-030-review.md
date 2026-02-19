# bead-0038 ADR-0030 review: 429/backoff, retry budgets, burst controls

## Review checks

- 429 handling: wrapper retries only `RateLimited` failures.
- Backoff behavior: bounded exponential backoff with optional Retry-After override.
- Retry budgets: max retries enforced; budget usage and remaining values emitted.
- Burst controls: per-minute quota scheduling blocks additional dispatches in same window.

## Evidence

- `src/application/services/quota-aware-execution.ts`
  - `invokeMachineWithQuotaRetryV1`
  - `scheduleQuotaAwareDispatchV1`
- `src/application/services/quota-aware-execution.test.ts`
  - 429 retry path
  - Retry-After override
  - budget exhaustion bounded
  - non-rate-limited no-retry
  - burst-control minute-window enforcement

## Outcome

- Review criteria satisfied for bounded and observable quota behavior in application primitives.
- Full `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
