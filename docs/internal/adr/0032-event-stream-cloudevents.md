# ADR-0032: CloudEvents as Event Stream Envelope

## Status

Accepted

## Context

VAOP produces events for runs, approvals, evidence, and adapter operations. External consumers (dashboards, sinks, alerting) need a stable event envelope to build reliable integrations. Custom event formats create downstream chaos.

## Decision

All externally published events use the CloudEvents specification (v1.0) as the envelope format. Events carry stable metadata attributes: `tenantid`, `runid`, `actionid`, `correlationid`, `source`, `type`, `subject`, and `datacontenttype`. Internal domain events are mapped to CloudEvents at the event stream boundary. The event stream supports filtering by tenant, event type, and correlation ID.

## Consequences

- Simplifies building dashboards, sinks, and alerting integrations.
- Aligns with industry standard adopted by CNCF.
- Adds a mapping layer between domain events and CloudEvents.
- Event schema versioning follows CloudEvents conventions.
