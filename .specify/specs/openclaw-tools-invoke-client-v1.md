# OpenClaw Tools Invoke Client v1

## Purpose

Define constrained `/tools/invoke` client behavior for OpenClaw tool execution in infrastructure.

## Policy Gating

- Tool invocation must evaluate blast-radius policy before dispatch.
- Dangerous or over-tier tools must fail closed as `PolicyDenied`.
- Policy-gated failures must carry run-state mapping `PolicyBlocked`.

## Transport Requirements

- Endpoint: `POST /tools/invoke`.
- Bearer credential injection is required.
- Per-session routing key is sent via `x-openclaw-session-key` header.
- Request payload supports `dryRun` mode.

## Retry and Backoff

- Retry applies to timeout/network failures, HTTP `429`, and HTTP `5xx`.
- For HTTP `429`, `Retry-After` header must be respected when present.
- Invalid or missing `Retry-After` falls back to exponential backoff policy.

## Dry-Run Semantics

- `dryRun: true` must be forwarded to the gateway payload.
- Dry-run mode is intended for no-mutation execution paths.

## Test Expectations

Unit tests must cover:

- policy-blocked tool path (`PolicyBlocked`),
- per-session header routing and `dryRun` payload forwarding,
- `429` with `Retry-After` backoff compliance.
