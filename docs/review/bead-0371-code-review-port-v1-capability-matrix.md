# bead-0371 — Code review: Family-aware `PortV1` capability validation

## Objective

Validate that `src/domain/ports/port-v1.ts` enforces capability tokens from
`docs/domain/port-taxonomy.md`, and that domain docs/specs reflect this contract.

## Checks

- [x] Supported operations are restricted to `<noun>:<action>` format.
- [x] Capability tokens are validated per `PortFamily` against a domain-defined matrix.
- [x] Family/operation mismatch produces deterministic errors with supported values.
- [x] Tests cover happy and failure paths for capability parsing.
- [x] Spec text in `.specify/specs/port-v1.md` links parser behavior to taxonomy docs.
- [x] `docs/domain/README.md` reflects the single-port parser structure.

## Findings

- Parser and tests are aligned to family-scoped capability validation.
- No architecture boundary violations were introduced (`domain` stays inside domain package).
- `PortV1.supportedOperations` now uses strongly typed `PortCapability` values.
- Error surfaces are actionable and include supported value lists when a family mismatch occurs.

## Open items

- No critical issues identified in this review.
