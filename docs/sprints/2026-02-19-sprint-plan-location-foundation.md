# Sprint Plan: Location Foundation Slice (2026-02-19)

## Goal

Close a dependency-complete, high-leverage slice that unlocks the location map delivery path:

- `bead-0505` (ADR robotics integration architecture)
- `bead-0552` (location-integrated map operations spec)
- `bead-0560` (LocationEvent domain model)
- `bead-0561` (MapLayer domain model)
- `bead-0564` (location telemetry governance baseline)

This sprint intentionally stops before infra ingestion/API transport implementation so downstream teams can build on stable contracts and domain invariants.

## Why this slice

- It is on the current critical path for open map/location work.
- It removes blockers for `bead-0553`, `bead-0562`, and `bead-0554`.
- It keeps sprint risk bounded to ADR/spec/domain/governance artifacts with strong testability.

## Ordered Execution Plan

1. `bead-0505` (domain, P1)
   - Record control-plane vs edge-gateway split and protocol stance.
   - Define explicit boundary for what Portarium governs vs edge safety controllers.
2. `bead-0552` (domain/spec, P1; blocked by `bead-0505`)
   - Specify `LocationEvent`, `MapLayer`, and live/history API contract expectations.
   - Identify boundary test targets per endpoint in spec text.
3. `bead-0560` (domain, P1; blocked by `bead-0552`)
   - Add branded primitives and parser/invariant tests for frame-aware telemetry.
   - Enforce timestamp monotonicity per source stream and unknown-quality handling.
4. `bead-0561` (domain, P1; blocked by `bead-0552`)
   - Add map layer model and validation tests for frame/version constraints.
   - Document versioning and validity-window invariants.
5. `bead-0564` (governance, P1; blocked by `bead-0552`)
   - Define and enforce RBAC + retention baseline at API boundary contract level.
   - Add tests for unauthorized query rejection and retention-expiry behavior.

## Definition of Done

- All five beads are closed with acceptance criteria evidence.
- Specs updated under `.specify/specs/` for behavior and contract changes.
- Domain layer remains clean (`src/domain/` has no infrastructure/presentation imports).
- Tests added/updated with passing coverage gates.
- Quality gate passes: `npm run ci:pr`.
- `.beads/issues.jsonl` is updated and committed with code/spec changes.

## Commit Strategy

- Commit 1: ADR/spec decisions (`bead-0505`, `bead-0552`) + Beads updates.
- Commit 2: Domain implementation/tests (`bead-0560`, `bead-0561`) + Beads updates.
- Commit 3: Governance policy/tests (`bead-0564`) + Beads updates.
- Commit 4: Final gate fixups (if needed), `npm run ci:pr` evidence, and remaining Beads transitions.

## Risks and Controls

- Risk: ADR ambiguity creates rework in domain models.
  - Control: lock `bead-0505` first and reference it explicitly in spec/domain commits.
- Risk: scope bleed into infrastructure/websocket transport.
  - Control: defer `bead-0553`, `bead-0562`, `bead-0554` to next sprint by design.
- Risk: policy language drift vs existing glossary terms.
  - Control: validate terms against `docs/glossary.md` during spec/governance edits.

## Next Sprint Preview (after this slice)

- `bead-0553` (ingestion pipeline)
- `bead-0562` (map data services)
- `bead-0554` (live map transport API)
- `bead-0567` (VDA 5050/MassRobotics ingestion adapters)
