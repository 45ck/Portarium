# ADR-0030: Quota-Aware Execution

## Status

Accepted

## Context

SoR APIs impose rate limits, daily quotas, and batch size constraints. Workflows that ignore these fail unpredictably, creating a "flaky automation" perception that destroys user trust. Leaving quota management to individual adapters leads to inconsistent handling and duplicated retry logic across the platform.

## Decision

Quota-aware execution is a platform-level concern, not adapter glue. The execution engine provides:

- **Built-in throttling**: request rate is governed per-provider, per-tenant to stay within declared limits.
- **Exponential backoff**: transient failures and rate-limit responses trigger automatic retry with jitter.
- **Request batching**: where SoR APIs support batch endpoints, the engine coalesces individual operations.
- **Scheduling**: operations that would exceed daily quotas are deferred to the next available window.

Capability matrices declare quota semantics per action (rate limit, daily cap, batch size, retry-after semantics). Workflows degrade gracefully under quota pressure: pause, reschedule, or notify rather than fail. The Run aggregate tracks quota consumption as evidence.

## Consequences

- Prevents reliability failures perceived as "automation is flaky" by handling quota constraints systematically.
- Capability matrices become richer, with more fields to declare per adapter action.
- Adds platform complexity: quota tracking, scheduling, and backpressure become execution engine responsibilities.
- Adapters must accurately declare their quota characteristics; incorrect declarations lead to avoidable failures.
- Users gain visibility into quota-driven delays through evidence and Run status, rather than encountering opaque errors.
