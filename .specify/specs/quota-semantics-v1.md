# Quota Semantics v1 (Quota-Aware Execution)

## Purpose

Quota semantics let Portarium execute workflows reliably against Systems of Record (SoRs) that impose rate limits, daily quotas, and batch constraints.

This implements ADR-0030: quota-aware execution as a platform concern.

## Semantics

- Quota semantics are declared **per action** in capability matrices.
- Under quota pressure, execution should degrade gracefully: throttle, backoff, batch, or reschedule rather than fail.
- Values are hints that must be accurate enough to prevent predictable rate-limit failures; incorrect declarations reduce reliability.

## Schema (QuotaSemanticsV1)

Fields:

- `schemaVersion`: `1`
- `rateLimit?`: `RateLimitV1`
- `dailyCap?`: `DailyCapV1`
- `batching?`: `BatchingV1`
- `retryAfter?`: `RetryAfterSemanticsV1`
- `notes?`: string

### RateLimitV1

- `requestsPerMinute`: integer `>= 1`

### DailyCapV1

- `requestsPerDay`: integer `>= 1`
- `resetAtUtcHour?`: integer in `[0, 23]` (if the provider has a known daily reset time)

### BatchingV1

- `maxBatchSize`: integer `>= 1`

### RetryAfterSemanticsV1

Discriminated union:

- `{ kind: "None" }`
- `{ kind: "RetryAfterSeconds", headerName: string }`
- `{ kind: "RetryAfterHttpDate", headerName: string }`
- `{ kind: "ResetEpochSeconds", headerName: string }`

Header names are treated as case-insensitive at the transport boundary, but are stored as provided for diagnostics.
