# Agent Action Evidence Hooks v1

## Purpose

Define infrastructure hook behavior for agent lifecycle events so each agent action produces tamper-evident evidence plus a CloudEvents outbox emission.

## Supported Events

- `ActionDispatched`
- `ActionCompleted`
- `ActionFailed`

Non-agent events are ignored.

## Evidence Persistence

- For each supported event, persist an immutable JSON payload in WORM storage.
- Payload key shape:
  - `workspaces/{workspaceId}/runs/{runId}/agent-actions/{actionId}/{eventId}.json`
- Append an evidence entry through `EvidenceLogPort` with:
  - `category: "Action"`,
  - `links.runId`,
  - a `payloadRefs` snapshot URI pointing to the WORM object.

## Hash Chain

- Evidence entries are appended through the evidence log abstraction, which maintains ADR-029 hash-chain continuity.

## CloudEvents Emission

- Emit one `PortariumCloudEventV1` per supported agent event through `EventPublisher`.
- `source` is `portarium.control-plane.agent-runtime`.
- `type` mapping:
  - `ActionDispatched` -> `com.portarium.agent.ActionDispatched`
  - `ActionCompleted` -> `com.portarium.agent.ActionCompleted`
  - `ActionFailed` -> `com.portarium.agent.ActionFailed`
- CloudEvents include `tenantid`, `correlationid`, `runid`, and `actionid`.

## Validation

- `runId` and `actionId` are required in payload parsing (with `runId` fallback to aggregate id).
- Invalid payloads fail fast and do not produce partial writes.

## Test Expectations

Integration tests must verify:

- evidence entry creation for dispatched/completed/failed events,
- payload refs written to WORM storage,
- hash-chain continuity for appended entries,
- CloudEvents outbox emission for each lifecycle event,
- duplicate payload write is rejected by WORM semantics.
