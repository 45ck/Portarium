# AsyncAPI Event Definitions v1

## Purpose

Defines the channel contracts for Portarium CloudEvents published over NATS JetStream. The formal AsyncAPI specification is at `docs/spec/asyncapi/portarium-events.v1.yaml`.

## Channels

### Run Lifecycle (`portarium.events.{tenantId}.run.{eventType}`)

| Event Type  | Description                            |
| ----------- | -------------------------------------- |
| `started`   | Run transitioned to Running state      |
| `completed` | Run reached Succeeded state            |
| `failed`    | Run reached Failed state               |
| `paused`    | Run paused for approval or manual gate |
| `resumed`   | Paused run resumed after approval      |

### Approval Lifecycle (`portarium.events.{tenantId}.approval.{eventType}`)

| Event Type  | Description                               |
| ----------- | ----------------------------------------- |
| `requested` | Run requires human approval               |
| `granted`   | Approval granted by authorized user       |
| `denied`    | Approval denied                           |
| `expired`   | Approval request expired without decision |

### Agent Status (`portarium.events.{tenantId}.agent.{eventType}`)

| Event Type     | Description                               |
| -------------- | ----------------------------------------- |
| `registered`   | New agent registered with control plane   |
| `heartbeat`    | Periodic heartbeat from active agent      |
| `deregistered` | Agent deregistered                        |
| `quarantined`  | Agent quarantined due to policy violation |

### Evidence Events (`portarium.events.{tenantId}.evidence.{eventType}`)

| Event Type       | Description                          |
| ---------------- | ------------------------------------ |
| `appended`       | New evidence entry appended to chain |
| `chain-verified` | Evidence chain integrity verified    |

### Telemetry Events (`portarium.events.{tenantId}.telemetry.{eventType}`)

| Event Type | Description                                   |
| ---------- | --------------------------------------------- |
| `location` | Location telemetry from robot or mobile asset |
| `metric`   | Custom metric from connected system           |

## Envelope

All events use the CloudEvents v1.0 structured-mode JSON envelope with Portarium extension attributes:

- `tenantid` (required): Workspace/tenant identifier
- `correlationid` (required): Correlation identifier for traceability
- `runid` (optional): Run identifier when event relates to a specific run
- `actionid` (optional): Action identifier when event relates to a specific action

## Subscriber Expectations

1. **Idempotency:** Events are delivered at-least-once. Consumers must handle duplicates.
2. **Ordering:** Events are ordered per subject. Cross-subject ordering is not guaranteed.
3. **Filtering by workspace:** Subscribe to `portarium.events.{tenantId}.>` for all events in a workspace.
4. **Filtering by type:** Subscribe to `portarium.events.*.run.started` for a specific event type across tenants.
5. **Filtering by runId:** Inspect the `runid` CloudEvent extension attribute in the payload.
6. **Consumer groups:** Use durable NATS consumers with names scoped by workspace and consumer identity.

## Invariants

1. Every published event conforms to the `PortariumCloudEventV1` type.
2. The `type` field follows the pattern `com.portarium.{category}.{eventType}`.
3. The NATS subject is derived from `tenantid` and `type` fields of the CloudEvent.
4. The outbox dispatcher is the sole publisher to NATS.
