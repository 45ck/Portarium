# ADR-0057: Reference Cockpit Presentation Layer v1

## Status

Accepted

## Context

Portarium is a control-plane platform and already treats UI as a reference client of the API.  
Recent work required a concrete, implementable plan for a presentation layer that:

- preserves contract fidelity to OpenAPI `v1`,
- surfaces `Work Item`, `Run`, `Plan`, `Approval Gate`, and `Evidence Log` consistently,
- handles degraded realtime and auditability states clearly,
- and uses Problem Details errors for command and query UX.

## Decision

Adopt a first-pass `ops-cockpit` presentation package under `src/presentation/` with a contract-first data layer and explicit upgrade points for richer screens.

1. **Contract boundary remains explicit**
   - Control-plane calls live in `src/presentation/ops-cockpit/http-client.ts`.
   - Error handling uses Problem Details parsing/mapping before UI composition.
   - Cursor pagination helpers are used for list APIs.

2. **Data/API boundary is separated from rendering**
   - Domain primitives/components will consume typed DTOs only.
   - Transport errors are transformed into presentation errors with `instance` preserved.

3. **State strategy defaults**
   - Treat fetched entities (`Run`, `Plan`, `Approval`, `Evidence`, `Work Item`) as server state inputs.
   - Keep UI-state (selection/filtering/navigation context) scoped and explicit.

4. **Roadmap-first rollout**
   - Start with query/read-only and single-command flows (approval) before adding broader command surfaces.
   - Use explicit degraded realtime indicators and polling fallback until stream reliability is proven.

## Consequences

- The first-pass UI package is intentionally small and safe, suitable for API contract validation and early rollout.
- New features can be added by appending feature slices inside `ops-cockpit` without replacing the contract layer.
- The repository now has a concrete ADR-backed reference point for future presentation work and review checkpoints.

## Alternatives Considered

- **Build UI directly against raw fetch without a client boundary**
  - Rejected: increases contract drift risk and duplicates response parsing.
- **Postpone all frontend architecture decisions to later**
  - Rejected: slows down API contract validation and blocks trust-UI rollout for planned/predicted/verified effects.
- **Use a separate ADR for each component**
  - Rejected: unnecessary overhead for a shared foundational implementation package.

## Implementation Mapping

- Closed implementation coverage:
  - `bead-0295`
  - `bead-0336`
  - `bead-0333`
  - `bead-0349`
  - `bead-0353`
  - `bead-0427`
  - `bead-0441`
- Remaining follow-up gap for full live-data parity:
  - `bead-0590`
- ADR closure implementation mapping bead:
  - `bead-0612`
- ADR linkage verification review bead:
  - `bead-0613`

## Evidence References

- `src/presentation/ops-cockpit/http-client.ts`
- `src/presentation/ops-cockpit/http-client.test.ts`
- `src/presentation/ops-cockpit/problem-details.ts`
- `src/presentation/ops-cockpit/problem-details.test.ts`
- `src/presentation/runtime/control-plane-handler.ts`
- `src/presentation/runtime/control-plane-handler.test.ts`
- `src/presentation/runtime/control-plane-handler.machine-agent.contract.test.ts`
- `src/presentation/runtime/control-plane-handler.openapi.routes.review.test.ts`
- `.specify/specs/presentation-layer-reference-cockpit-v1.md`
- `docs/review/bead-0612-adr-0057-implementation-mapping-review.md`
