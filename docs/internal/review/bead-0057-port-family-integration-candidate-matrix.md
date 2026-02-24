# Bead-0057 Review: Port-Family Integration Candidate Matrix

## Scope

- Assign owner lanes for all 18 standard Portarium port families.
- Capture candidate provider set per family.
- Capture current blockers per family.
- Define required artefact dependencies before family kickoff.

## Artefacts Added

- `domain-atlas/decisions/port-family-integration-candidate-matrix.json`
- `docs/internal/research/port-family-integration-candidate-matrix.md`

## Documentation Updates

- `docs/internal/research/README.md`
- `.specify/specs/vaop-mvp-domain-atlas-research-programme.md`

## Notes

- Matrix intentionally excludes `RoboticsActuation` because this bead scope is "all 18 families" from the integration catalog baseline.
- Dependencies are expressed as reusable keys (`sourceManifest`, `providerDecision`, `cifExtract`, `canonicalMapping`, `capabilityMatrix`, `contractFixtures`) for downstream readiness gating.
