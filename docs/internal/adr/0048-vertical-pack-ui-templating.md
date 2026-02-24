# ADR-0048: Vertical Pack UI Templating and Theming

## Status

Accepted

## Context

Each vertical needs domain-specific forms, pages, and layouts, but building bespoke UIs per vertical is expensive and fragments the experience. A schema-driven approach reduces duplication while allowing vertical-specific customisation.

## Decision

Provide a schema-driven UI templating system:

- Forms and pages are generated from schema definitions plus UI hints.
- Role-based layouts and field visibility rules control what each user sees.
- Packs provide theme tokens and component variants within a bounded design system maintained by core.
- Packs declare UI templates in a JSON/YAML format that references schema fields, validation rules, and layout directives.
- The core template renderer resolves pack templates at runtime based on the tenant's enabled packs.

## Consequences

- Rapid vertical UX; consistent evidence capture; reduces bespoke UI forks.
- Requires a robust "UI contract" with backwards compatibility rules.
- Templates must be tested for accessibility and responsive behaviour.
- Universal templates (finance, admin) ship as a base pack included with core.

## Alternatives Considered

- **Pack-specific custom front-ends** -- high cost and fragmentation.
- **No vertical UI layer** -- forces tenants to build their own, reducing product value.
