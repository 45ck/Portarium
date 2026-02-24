# Review: bead-0649 (OpenAPI Routing-Enforcement Freeze)

Reviewed on: 2026-02-20

Scope:

- `docs/spec/openapi/portarium-control-plane.v1.yaml`
- `scripts/ci/openapi-breaking-check.mjs`
- `docs/internal/adr/0073-all-roads-through-control-plane-enforcement.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Verification Evidence

- Confirmed routing-critical OpenAPI operations are marked with `x-stability: stable` for:
  - runs,
  - approvals,
  - agent/machine registration and connectivity checks,
  - adapter registrations (capability declaration surface),
  - work-item listing,
  - event subscription.
- Confirmed CI breaking-change script now parses stable operations and fails if any baseline
  stable operation is removed/renamed.
- Confirmed ADR-0073 now cross-references the frozen OpenAPI subset and CI enforcement path.
