# Event-Stream Transport v1

## Purpose

Defines the transport layer that delivers CloudEvents from the transactional outbox to downstream subscribers. See ADR-0074 for the bus selection rationale.

## Transport: NATS JetStream

NATS JetStream is the primary event-stream transport for Portarium CloudEvents choreography.

## Delivery Semantics

- **Guarantee:** At-least-once delivery. Events may be delivered more than once; consumers must be idempotent.
- **Ack model:** Consumer-driven explicit ack (`AckExplicit`). Events remain pending until the consumer acknowledges.
- **Ordering:** Ordered per NATS subject. Events within a single subject arrive in publish order.
- **Deduplication:** JetStream dedup window uses `Nats-Msg-Id` header set to the CloudEvent `id`.
- **Replay:** Consumers can replay from stream start or from a specific sequence number.

## Subject Hierarchy

```
portarium.events.{tenantId}.{eventCategory}.{eventType}
```

### Event Categories and Types

| Category    | Types                                                 | Description               |
| ----------- | ----------------------------------------------------- | ------------------------- |
| `run`       | `started`, `completed`, `failed`, `paused`, `resumed` | Run lifecycle events      |
| `approval`  | `requested`, `granted`, `denied`, `expired`           | Approval lifecycle events |
| `agent`     | `registered`, `heartbeat`, `deregistered`             | Agent status events       |
| `evidence`  | `appended`, `chain-verified`                          | Evidence chain events     |
| `telemetry` | `metric`, `trace`, `log`                              | Telemetry export events   |

### Subscription Patterns

- `portarium.events.{tenantId}.>` -- all events for a specific tenant
- `portarium.events.*.run.>` -- all run events across tenants (ops dashboards)
- `portarium.events.{tenantId}.run.started` -- specific event type for a tenant

## JetStream Stream Configuration

| Property         | Value                 |
| ---------------- | --------------------- |
| Stream name      | `PORTARIUM_EVENTS`    |
| Subjects         | `portarium.events.>`  |
| Storage          | File                  |
| Retention        | Limits                |
| MaxAge           | 7 days (configurable) |
| MaxMsgs          | 1,000,000             |
| Discard policy   | Old                   |
| Duplicate window | 2 minutes             |

## Consumer Configuration

- Durable consumers use names scoped by workspace and consumer identity.
- Pattern: `{workspaceId}-{consumerName}` (e.g., `ws-acme-cockpit-projections`).
- Ack wait: 30 seconds (configurable).
- Max deliver: 5 (configurable).
- Ack policy: `AckExplicit`.

## Message Format

Events are published as structured-mode CloudEvents (JSON) with the following NATS headers:

- `Nats-Msg-Id`: CloudEvent `id` (enables JetStream deduplication)
- `Content-Type`: `application/cloudevents+json`

## Infrastructure

- Local development: NATS container in `docker-compose.yml` (port 4222, JetStream enabled).
- Kubernetes: NATS Helm chart or NATS Operator with persistent volumes.

## Invariants

1. Every CloudEvent published to NATS must have a valid `tenantid` and `type` for subject derivation.
2. The outbox dispatcher is the sole publisher; application code does not publish directly to NATS.
3. Consumer ack failures trigger redelivery up to `maxDeliver` times before the message is moved to a dead-letter subject.
