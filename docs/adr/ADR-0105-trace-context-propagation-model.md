# ADR-0105: Trace-Context Propagation and Correlation Model

## Status

Accepted

## Context

Portarium orchestrates execution across multiple services: Cockpit UI, API
(control plane), Temporal workflows, adapter executions, CloudEvents emission,
approval creation/decision, and evidence ingestion. For an auditor to navigate
from a cockpit action to exact downstream side effects via a single trace ID,
every hop must propagate W3C Trace Context consistently.

The CloudEvents specification defines a `traceparent` extension attribute
(CloudEvents Distributed Tracing Extension) for exactly this purpose.

## Decision

### Propagation Chain

Every request entering Portarium carries (or generates) a W3C `traceparent`
and optional `tracestate`. These propagate through the full execution chain:

```
Cockpit UI
  +- traceparent header --> API (control plane)
  |                           +- AppContext.traceparent
  |                           +- OTel span (parent from traceparent)
  |                           +- Command execution span
  |                           +- Temporal workflow input.traceparent
  |                           |     +- Activity spans
  |                           |     +- Evidence entries (traceparent recorded)
  |                           +- CloudEvents (traceparent extension)
  |                           +- Evidence ingestion (traceparent in entry)
  +- response traceparent <-
```

### Correlation Identifiers

| Identifier      | Scope           | Purpose                                      |
| --------------- | --------------- | -------------------------------------------- |
| `traceparent`   | Cross-service   | W3C distributed trace (trace ID + span ID)   |
| `correlationId` | Request/command | Logical operation grouping (UUID per action) |
| `runId`         | Workflow run    | Links all evidence to a specific execution   |
| `tenantId`      | Workspace       | Multi-tenant isolation boundary              |

### CloudEvents Distributed Tracing Extension

All PortariumCloudEventV1 instances include `traceparent` as an optional
extension attribute, following the CloudEvents Distributed Tracing Extension
specification. This enables consumers to correlate events back to the
originating trace.

### Evidence Trace Linking

Evidence entries include `traceparent` when available, enabling auditors to:

1. Start from an evidence entry
2. Extract the trace ID from traceparent
3. Query the tracing backend for the full execution trace
4. See every service hop that contributed to the evidence

### Structured Logging

All structured log lines include `traceId` and `spanId` extracted from the
active OTel context. This enables log correlation in log aggregation systems
(Grafana Loki, Elasticsearch) by joining on trace ID.

## Consequences

- Auditors can navigate from any cockpit action to downstream effects via trace ID.
- CloudEvents consumers can correlate events to API requests.
- Evidence entries are trace-linked for compliance queries.
- Structured logs are joinable with traces in observability backends.
- All propagation uses W3C Trace Context standard (no proprietary headers).
