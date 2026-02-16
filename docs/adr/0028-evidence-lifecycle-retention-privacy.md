# ADR-0028: Evidence Lifecycle Retention and Privacy

## Status

Accepted

## Context

VAOP's evidence trail is a key differentiator, but "append-only and immutable forever" conflicts with privacy regulations (GDPR right to erasure), storage costs, and tenant-specific retention requirements in HR/legal/finance contexts. A blanket immutability policy makes the platform non-viable in regulated industries where data disposition is a legal obligation.

## Decision

Split evidence into two tiers:

1. **Immutable metadata events** (who/what/when/policy decision/links to external objects) that form the tamper-evident audit chain. PII is minimised in these logs; they reference external objects by opaque identifier rather than embedding personal data.
2. **Retention-managed payloads** (artifacts, drafts, raw provider snapshots) subject to tenant retention schedules, disposition workflows (destroy/de-identify), and legal-hold exceptions.

Tenants configure retention schedules per evidence category. Disposition workflows execute destroy or de-identify actions when retention periods expire, unless a legal hold is active. Legal-hold management overrides retention schedules for the duration of the hold.

## Consequences

- Makes VAOP viable in regulated contexts (HR, legal, finance) by supporting GDPR right to erasure and tenant retention policies.
- Adds complexity: retention scheduler, disposition workflows, legal-hold management become platform concerns.
- Immutable metadata remains the audit backbone even after payload disposition, preserving the evidence chain's integrity.
- Storage costs become manageable through lifecycle policies rather than unbounded growth.
