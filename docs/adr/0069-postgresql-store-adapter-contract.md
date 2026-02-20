# ADR-0069: PostgreSQL Store Adapter Contract

## Status

Accepted

## Context

Application commands and queries depend on store, outbox, event publisher, and ID-generation ports. Prior runtime wiring used in-memory placeholders, which blocked infrastructure integration work and prevented adapter-level integration testing.

## Decision

Introduce infrastructure adapters under `src/infrastructure/postgresql/` with a shared SQL client contract.

- `SqlClient` defines the minimal query interface used by repositories.
- PostgreSQL store adapters implement application ports for:
  - workspace/run/workflow/adapter-registration/approval/policy/idempotency,
  - work-item/workforce member/human task/workforce queue,
  - evidence log append chaining,
  - outbox persistence and publisher bridge,
  - ID generation via cryptographic UUID.
- Runtime dependency wiring supports PostgreSQL-backed workspace/run stores when:
  - `PORTARIUM_USE_POSTGRES_STORES=true`
  - `PORTARIUM_DATABASE_URL` is configured
- Default runtime behavior remains in-memory fallback when PostgreSQL wiring is disabled.

## Consequences

- Infrastructure adapters are now concrete and testable behind the application-port boundary.
- Deployments can opt into PostgreSQL stores without changing application-layer code.
- Outbox and evidence persistence have infrastructure implementations ready for broader command wiring.
- A full production schema rollout still depends on migration execution and deploy-time table management.

## Alternatives Considered

- Keep runtime-level in-memory placeholders
  - Rejected: no persistence parity and no adapter integration evidence.
- Bind application layer directly to `pg`
  - Rejected: violates port-adapter layering and reduces testability.
