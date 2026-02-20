# OpenClaw Gateway Machine Invoker v1

## Purpose

Define infrastructure adapter behavior for invoking OpenClaw Gateway as a `MachineInvokerPort` implementation.

## Endpoint Contract

- `runAgent` dispatches to `POST /v1/responses`.
- Request `model` is always `openclaw:<agentId>`.
- Correlation metadata (`tenantId`, `runId`, `actionId`, `correlationId`) is included in request metadata.

## Credential Injection

- Requests must include `Authorization: Bearer <token>`.
- Bearer token is resolved through an injected credential resolver (vault-backed in production).
- If token resolution fails, invocation returns `Unauthorized` without dispatching an HTTP request.

## Reliability

- Request timeout is enforced per call.
- Retry/backoff applies to retryable failures:
  - network errors,
  - request timeout,
  - HTTP `429`,
  - HTTP `5xx`.
- Non-retryable `4xx` returns immediate failure.

## Failure Mapping

- `401`/`403` -> `Unauthorized`
- `429` -> `RateLimited`
- `409` -> `PolicyDenied`
- timeout -> `Timeout`
- other failures -> `RemoteError`

## Test Expectations

Unit tests must cover:

- successful `/v1/responses` invocation,
- one `4xx` failure path,
- one retrying `5xx` path,
- timeout behavior.
