# bead-0049 ADR-0036 implementation: Portarium identity labels and telemetry metadata

## Changes

- Standardized product-facing naming to Portarium across key docs/spec files:
  - `README.md`
  - `package.json`
  - `docs/spec/openapi/portarium-control-plane.v1.yaml`
  - `.specify/memory/constitution.md`
  - `.specify/specs/canonical-objects-v1.md`
  - `.specify/specs/vertical-packs.md`
  - `.specify/specs/vaop-mvp-domain-atlas-research-programme.md`
- Updated error envelope fixtures to Portarium problem URIs:
  - `src/presentation/ops-cockpit/problem-details.test.ts`
  - `src/presentation/ops-cockpit/http-client.test.ts`
- Added explicit telemetry namespace constant for CloudEvents type generation:
  - `PORTARIUM_TELEMETRY_NAMESPACE` in `src/application/events/cloudevent.ts`

## Verification

- Targeted tests pass for updated error-envelope and telemetry mapping surfaces.
- `typecheck` passes.
- `ci:pr` remains blocked by pre-existing gate baseline mismatch:
  - `package.json` hash mismatch
  - missing `knip.json` in baseline
