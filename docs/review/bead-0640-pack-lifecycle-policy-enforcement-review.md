# Review: bead-0640 (Pack Lifecycle Policy Enforcement)

Reviewed on: 2026-02-20

Scope:

- `src/domain/packs/pack-manifest.ts`
- `src/domain/packs/pack-manifest.test.ts`
- `src/domain/packs/pack-resolver.ts`
- `src/domain/packs/pack-resolver.test.ts`
- `src/domain/packs/pack-registry.ts`
- `src/domain/packs/pack-registry.test.ts`
- `src/domain/packs/pack-enablement-compliance-v1.test.ts`
- `src/domain/packs/software-change-management-reference-pack.test.ts`
- `vertical-packs/software-change-management/pack.manifest.json`
- `.specify/specs/vertical-packs.md`
- `docs/vertical-packs/compatibility-matrix.md`
- `docs/vertical-packs/README.md`
- `docs/adr/0052-vertical-pack-lifecycle-policy.md`

## Findings

High:

- none.

Medium:

- none.

Low:

- none.

## Acceptance Evidence

Implemented ADR-0052 lifecycle policy enforcement across pack contracts and resolution flow:

- Added manifest lifecycle contract with explicit status catalogue:
  - `experimental`, `beta`, `stable`, `LTS`, `deprecated`, `end-of-life`.
- Added support-window contract for `Current`/`LTS` trains:
  - ISO start/end validation,
  - train uniqueness checks,
  - minimum duration checks (`Current` >= 180 days, `LTS` >= 365 days),
  - status-to-train requirements (`stable`/`beta`/`experimental`/`deprecated` -> `Current`,
    `LTS` -> `LTS`).
- Enforced resolver lifecycle gates:
  - requires active support window on the status-required train,
  - blocks `deprecated` and `end-of-life` versions for new tenants by default,
  - supports explicit policy override for controlled exceptions.
- Added registry lifecycle-catalog output (`listPackCatalogEntries`) exposing version + status.
- Updated reference pack manifest and parser tests to include lifecycle metadata.
- Added support policy documentation and spec linkage:
  - `docs/vertical-packs/compatibility-matrix.md`
  - `.specify/specs/vertical-packs.md`
- Updated ADR-0052 mapping/evidence and marked remaining gap as closed.
