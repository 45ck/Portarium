# Machines/Agents Schema Versioning v1

**ADR:** ADR-0098
**Bead:** bead-0787

## Purpose

Define the versioning contract for the `MachineRegistrationV1` and
`AgentConfigV1` domain payload schemas stored in the database. These schemas
carry a `schemaVersion` integer field that parsers use to reject payloads
written by an incompatible version of the control plane.

## Versioning rules

### Backward-compatible changes (no version bump)

The following changes may be added to v1 without incrementing `schemaVersion`:

- Adding an optional field with a default value.
- Widening a type (e.g., adding values to a union type).
- Adding a new optional nested object.

### Breaking changes (require v2)

The following changes require a schemaVersion bump to 2:

- Removing any existing field.
- Making an optional field required.
- Narrowing a type (e.g., removing values from a union type).
- Changing the semantic meaning of an existing field.

## Migration pattern

When a breaking change is needed:

1. **Expand**: deploy new code that can parse BOTH v1 and v2. Add new fields
   with defaults. DB migration adds nullable columns if needed.
2. **Migrate**: run a background job or SQL migration to convert all v1 records
   to v2.
3. **Contract**: deploy new code that rejects v1. DB migration drops any
   columns no longer needed by v2.

## Enforcement

- Parsers (`parseMachineRegistrationV1`, `parseAgentConfigV1`) MUST throw
  `*ParseError` with the message `Unsupported schemaVersion: N` for any
  unknown version.
- Tests MUST verify rejection of unknown versions (e.g., schemaVersion 99).

## Current schema versions

| Type                  | schemaVersion | Source                                           |
| --------------------- | ------------- | ------------------------------------------------ |
| MachineRegistrationV1 | 1             | `src/domain/machines/machine-registration-v1.ts` |
| AgentConfigV1         | 1             | `src/domain/machines/machine-registration-v1.ts` |
