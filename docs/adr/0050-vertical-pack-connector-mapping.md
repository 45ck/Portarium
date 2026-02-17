# ADR-0050: Vertical Pack Connector Mapping to Systems of Record

## Status

Accepted

## Context

Vertical packs integrate with domain-specific SoRs (SIS/LMS for education, POS for hospitality, field service tools for trades). The core connector runtime handles auth, rate limiting, retries, idempotency, and secrets. Packs need to provide the domain-specific mapping rules without duplicating runtime concerns.

## Decision

Implement connectors as: a stable core connector runtime (auth, rate limiting, retries, idempotency, secrets management -- leveraging ADR-030 quota-aware execution); pack-provided mapping definitions (field mappings, transformations, identity resolution rules); and an adapter pattern for third-party systems whose APIs do not match core contracts.

Connector mappings are versioned independently from the pack (e.g., `square.orders@1.x`) to allow connector module updates without full pack upgrades.

The core connector runtime supports multiple protocol styles: REST, GraphQL, and CSV file exchange.

## Consequences

- Consistent reliability and evidence capture; pack-level mapping variance does not destabilise core
- Mappings can become complex; need strong tooling (diff, test fixtures, replay)
- Connector modules are independently versionable and testable
- Enables sharing connector modules across packs (e.g., Xero invoicing used by both hospitality and trades)

## Alternatives Considered

- **Hand-coded connector per vertical/vendor** -- faster initially but scales poorly
- **Rely only on file-based ingest** -- works for some education flows (CSV) but not for realtime operations
