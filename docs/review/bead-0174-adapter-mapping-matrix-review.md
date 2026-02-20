# Review: bead-0174 (Adapter Mapping and Operation Matrix Preconditions)

Reviewed on: 2026-02-20

Scope:

- Open adapter implementation beads
- Canonical-to-provider mapping evidence
- Operation matrix completeness/readiness checks

## Acceptance Evidence

Objective:

- Verify adapter work does not start without canonical/provider mapping evidence and operation matrix completeness.

Verification commands:

```bash
npm run domain-atlas:readiness
npm run domain-atlas:ops-stubs:verify
```

Reports:

- `reports/domain-atlas/port-family-readiness.json`
- `reports/domain-atlas/operation-contract-stub-verification.json`

Key results:

- Readiness report: `18` families total, `2` currently marked ready.
- Operation-contract verification: `18` families checked, `8` fully passing.

Provider evidence spot-check for open reference-adapter beads:

- `mautic`: mapping/capability present
- `odoo` + `erpnext`: mapping/capability present
- `zammad`: mapping/capability present
- `github`: mapping/capability missing

Enforcement action taken:

- Created prerequisite bead: `bead-0589` (`Domain Atlas: GitHub intake (CIF + mapping + capability matrix)`).
- Added blocker on adapter implementation bead:
  - `bead-0424` now blocked by `bead-0589`.

Conclusion:

- A concrete no-evidence gap was identified and is now blocked from implementation start.
- Mapping/matrix prerequisites are partially satisfied across families, but global readiness remains incomplete.

## Findings

High:

- GitHub reference adapter work (`bead-0424`) had no canonical mapping/capability evidence path; now mitigated by explicit blocker (`bead-0589`).

Medium:

- Operation matrix verification is not fully passing across all families (`8/18` fully passing), so broad adapter expansion remains governance-constrained.

Low:

- none.
