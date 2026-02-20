# Langflow Agent Flow HTTP Adapter v1

## Context

Portarium needs an infrastructure adapter that dispatches workflow actions to Langflow flow runs while preserving run-correlation headers.

## Scope

- Add an `ActionRunnerPort` implementation for Langflow flow invocation.
- Resolve `flowRef` to `POST /v1/run/<flow-id>` (or use absolute URL `flowRef` as-is).
- Propagate correlation envelope headers:
  - `tenantId`
  - `correlationId`
  - `runId`
- Support optional Langflow API key via `x-api-key`.
- Map HTTP failures to `ActionDispatchResult` failure kinds:
  - `401/403 -> Unauthorized`
  - `404 -> FlowNotFound`
  - `429 -> RateLimited`
  - timeout abort -> `Timeout`
  - other non-2xx -> `RemoteError`

## Acceptance

- Adapter issues HTTP POST requests to Langflow run endpoints.
- Correlation headers are present on each dispatch.
- Successful responses map to `{ ok: true, output }`.
- Timeout and not-found paths are covered by unit tests.
