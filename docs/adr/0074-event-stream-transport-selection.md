# ADR-0074: Event-Stream Transport Selection

**Beads:** bead-0657
**Status:** Accepted
**Date:** 2026-02-21

## Context

Portarium emits CloudEvents for external choreography (ADR-0070). The control plane needs a
reliable event transport that supports:

- at-least-once delivery with consumer acknowledgment,
- durable persistence for replay and late-joining consumers,
- multi-tenant subject routing (per-workspace event streams),
- CloudEvents-native envelope support,
- low operational overhead for self-hosted deployments.

The transactional outbox (`src/application/ports/outbox.ts`) already guarantees that events
are persisted atomically with business state changes. The transport layer sits downstream
of the outbox dispatcher and delivers events to external subscribers.

## Options Evaluated

### 1. Apache Kafka

- Battle-tested, high throughput, strong ecosystem.
- Heavy operational footprint: ZooKeeper/KRaft, partition management, broker tuning.
- Over-provisioned for Portarium MVP volumes.

### 2. Redis Streams

- Simple, already familiar infrastructure primitive.
- No built-in consumer group persistence across restarts without explicit XACK tracking.
- Limited replay capabilities compared to purpose-built event brokers.

### 3. NATS JetStream

- Lightweight single-binary deployment, minimal ops overhead.
- Built-in persistence with configurable retention (time, size, interest).
- Native subject-based routing aligns with CloudEvents type hierarchy.
- At-least-once delivery with explicit acknowledgment and redelivery.
- CloudEvents content type support via structured-mode JSON.
- Scales horizontally when needed via NATS clustering.

## Decision

**NATS JetStream** is selected as the event-stream transport for Portarium MVP.

### Rationale

1. **Operational simplicity** -- single binary, zero external dependencies (no ZooKeeper).
2. **Delivery semantics** -- at-least-once with configurable max-deliver and ack-wait.
3. **Subject-based routing** -- maps naturally to CloudEvents type hierarchy
   (`portarium.events.runs.started`, `portarium.events.agents.registered`).
4. **Retention flexibility** -- time-based, size-based, or interest-based retention per stream.
5. **Self-hosted friendliness** -- small resource footprint suits single-node and edge deployments.

### Stream Design

| Stream | Subjects | Retention |
|--------|----------|-----------|
| `PORTARIUM_RUNS` | `portarium.events.runs.>` | 30 days |
| `PORTARIUM_EVIDENCE` | `portarium.events.evidence.>` | 90 days |
| `PORTARIUM_AGENTS` | `portarium.events.agents.>` | 7 days |
| `PORTARIUM_TELEMETRY` | `portarium.events.telemetry.>` | 24 hours |

### Consumer Groups

Consumers use durable consumer names scoped by workspace and consumer identity.
Pattern: `{workspaceId}-{consumerName}` (e.g., `ws-abc-cockpit-projections`).

### Delivery Semantics

| Property | Value |
|---|---|
| Delivery guarantee | At-least-once |
| Ack model | Consumer-driven explicit ack (AckExplicit) |
| Ordering | Ordered per NATS subject |
| Deduplication | JetStream message-level dedup via `Nats-Msg-Id` header (set to CloudEvent `id`) |
| Replay | Full replay from stream start or by sequence number |

### Subject Hierarchy

```
portarium.events.{tenantId}.{eventCategory}.{eventType}
```

Examples:
- `portarium.events.ws-acme.run.started`
- `portarium.events.ws-acme.approval.granted`
- `portarium.events.ws-acme.agent.heartbeat`

Consumers may subscribe to:
- `portarium.events.ws-acme.>` -- all events for a tenant
- `portarium.events.*.run.>` -- all run events across tenants (ops dashboards)

## Consequences

- NATS is added to `docker-compose.yml` for local development.
- `NatsEventPublisher` implements the `EventPublisher` port.
- Kafka migration path remains open: the `EventPublisher` port abstraction means
  swapping transports requires only a new adapter, no application-layer changes.
- AsyncAPI spec (bead-0658) defines channel contracts over NATS subjects.
- The outbox dispatcher publishes to NATS subjects derived from the CloudEvent `tenantid` and `type` fields.
