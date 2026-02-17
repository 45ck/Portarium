# Zammad

- Provider ID: `zammad`
- Port Families: `CustomerSupport`
- Upstream: `https://github.com/zammad/zammad`
- Pinned commit: `a701e6837daaca55e722259b3309096847593232`
- License: AGPLv3 (`AGPL-3.0-only`, `study_only`)

## What To Extract Next

- API payload shapes and invariants (Ticket create/update, TicketArticle create, attachments).
- Custom fields/object manager attributes and extension surfaces.
- Ticket lifecycle semantics (state transitions, SLA timers, escalation fields) and safe defaults.
- Webhook event schema and delivery guarantees.

## Current Extraction (Initial)

- CIF: `domain-atlas/extracted/zammad/cif.json`
- Mapping: `domain-atlas/mappings/zammad/CustomerSupport.mapping.json`
- Capability matrix: `domain-atlas/capabilities/zammad/CustomerSupport.capability-matrix.json`
- Re-run: `npm run domain-atlas:extract:zammad`

Entities extracted from foundational migrations under `domain-atlas/upstreams/zammad/db/migrate/`:

- `User`, `Organization`, `Group`
- `Ticket`, `TicketArticle`
- `Store*` (attachment/file surfaces)
- `Tag*` (tagging surfaces)
- Ticket lookup tables (state, priority, article type/sender)

## Mapping Notes (Canonical)

- Canonical `Ticket` maps cleanly; most other objects should remain provider-native (`ExternalObjectRef`) until canonical comment/attachment/tag semantics are finalised.
- Canonical `Party` maps to `User` and `Organization`; adapter assigns role tags based on permissions and usage context.

## Capability Matrix Notes

- Prefer conservative default tiers for write operations; ticket updates and comments are externally-effectful.
- Evidence capture must redact sensitive content by default (ticket bodies, attachments), while preserving auditability (paths, hashes, metadata).

## Open Questions

- How to model custom fields in a portable way (object manager attributes vs canonical extension points)?
- What is the minimal safe attachment/document surface for evidence without data leakage?
