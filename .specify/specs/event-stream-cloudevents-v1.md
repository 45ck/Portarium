# Event Stream v1 (CloudEvents Envelope)

## Purpose

Portarium publishes an append-only event stream for runs, approvals, evidence, and adapter operations. Downstream consumers (dashboards, sinks, alerting) require a stable envelope to build reliable integrations.

This implements ADR-0032: CloudEvents as the external event stream envelope.

## Semantics

- All externally published events use the CloudEvents specification (v1.0) as the envelope.
- Attribute names use the CloudEvents canonical lower-case form.
- Portarium uses CloudEvents extension attributes to carry stable cross-cutting identifiers:
  - `tenantid` (always present)
  - `correlationid` (always present)
  - `runid` (present when the event relates to a Run)
  - `actionid` (present when the event relates to a specific Action)

## Schema (PortariumCloudEventV1)

### Required CloudEvents attributes

- `specversion`: `"1.0"`
- `id`: string (event identifier)
- `source`: string (producer identifier)
- `type`: string (event type identifier)

### Optional CloudEvents attributes

- `subject?`: string
- `time?`: ISO-8601/RFC3339 UTC timestamp string
- `datacontenttype?`: string (e.g. `application/json`)
- `dataschema?`: string (URI)

### Portarium extension attributes

- `tenantid`: branded `TenantId`
- `correlationid`: branded `CorrelationId`
- `runid?`: branded `RunId`
- `actionid?`: branded `ActionId`

### Payload

- `data?`: JSON value (event payload)
