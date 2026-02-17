# Domain Event v1 (Domain layer envelope)

## Purpose

Domain events are authoritative internal facts emitted by aggregates (`Workspace`, `Workflow`, `Run`, `Policy`, `Adapter`, `Port`) and captured by application services before mapping to outbound channels.

This document tracks the domain parser in `src/domain/events/domain-events-v1.ts`.

## Schema (`DomainEventV1`)

- `schemaVersion`: `1`
- `eventId`: non-empty string
- `eventType`: one of the registered domain event types
- `aggregateKind`: one of `Workspace`, `Workflow`, `Run`, `Policy`, `AdapterRegistration`, `Port`, `Unknown`
- `aggregateId`: non-empty string
- `occurredAtIso`: ISO timestamp string
- `actorUserId?`: branded `UserId` (optional, non-empty)
- `correlationId?`: branded `CorrelationId` (optional, non-empty)
- `payload?`: object when provided (optional)

## Aggregate-aware parsers

- `parseDomainEventsV1`: parses a `DomainEventV1[]` from an array input and validates each entry.
- `parseDomainEventsForAggregateKindV1`: parses `DomainEventV1[]`, enforces a single aggregate kind for all entries, and enforces a single `aggregateId` within the returned set.
- `parseDomainEventStreamV1`: parses `DomainEventV1[]` for one aggregate stream by kind and aggregateId, and enforces strict stream invariants.
- `parseDomainEventStreamEnvelopeV1`: parses a stream envelope object containing aggregate id, aggregate kind, and stream events.

## Aggregate/event pairing constraints

- Aggregate-event combinations are validated by parser:
  - `Workspace`: workspace lifecycle and user/grant events
  - `Workflow`: workflow lifecycle events
  - `Run`: run lifecycle and approval events
- `Policy`: policy lifecycle events
- `AdapterRegistration`: adapter lifecycle and related port lifecycle events
- `Port`: port lifecycle events

## Aggregate stream invariants

- The aggregate stream parser must reject any mixed-id stream where `aggregateId` differs from the expected aggregate id.
- Event ordering is strict-by-spec on stream time; `occurredAtIso` values must be non-decreasing across the parsed array.
- Malformed envelopes (e.g., non-array payloads or empty aggregate identifiers) are rejected with contextual errors.
