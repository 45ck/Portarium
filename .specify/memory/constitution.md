# VAOP Specification Memory — Constitution

This file captures the foundational rules and constraints that govern VAOP specifications.
Speckit agents must consult this before generating or validating specs.

## Core invariants

1. **VAOP is a control plane, not a System of Record.** It coordinates; SoRs own truth.
2. **Approvals are native and non-negotiable.** Never delegate approval governance to an external system.
3. **Evidence is append-only and tamper-evident.** Immutable metadata is never mutated or deleted; payloads/artifacts are retention-managed and may be destroyed or de-identified under policy/legal-hold rules while preserving the metadata chain.
4. **Tenant isolation is first-class.** No cross-tenant data leakage under any circumstance.
5. **Every action has an execution tier.** Auto, Assisted, Human-approve, or Manual-only — no unclassified actions.
6. **Adapters must pass contract tests and declare a capability matrix** before registration.
7. **Machines and adapters are hard-separated.** Machines produce artifacts; adapters sync with SoRs.
8. **Idempotency is required** for all adapter write operations.
9. **The canonical domain model is intentionally minimal.** Complex domains stay in adapters/SoRs.
10. **API-first: the dashboard is a client, not the product.** All functionality is available via Commands, Queries, and Event Stream.

## Terminology

All specs must use the terms defined in `docs/glossary.md`. See `docs/ubiquitous-language.md` for the authoritative source.
