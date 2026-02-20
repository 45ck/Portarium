# Activepieces Action Executor v1

## Purpose

Define infrastructure adapter behavior for dispatching workflow actions to Activepieces as an `ActionRunnerPort` implementation.

## Dispatch Contract

- Input `flowRef` resolves execution endpoint as:
  - absolute `http(s)` URL -> used directly,
  - otherwise -> `{baseUrl}/api/v1/flows/{flowRef}/run`.
- Requests are `POST` with JSON payload:
  - `actionId`
  - `flowRef`
  - `tenantId`
  - `runId`
  - `correlationId`
  - `payload`

## Correlation Header Propagation

Every request must include:

- `tenantId`
- `correlationId`
- `runId`

Optional auth:

- `Authorization: Bearer <apiToken>` when configured.

## Failure Mapping

- `401`/`403` -> `Unauthorized`
- `404` -> `FlowNotFound`
- `429` -> `RateLimited`
- request timeout/abort -> `Timeout`
- all other failures -> `RemoteError`

## Test Expectations

Unit tests must cover:

- successful dispatch with correlation headers,
- endpoint resolution for relative and absolute `flowRef`,
- `404` and `429` mapping,
- timeout mapping.
