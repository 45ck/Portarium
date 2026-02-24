# Bead-0689 Review: SchemaVersion 2 Capability Cutover

## Scope

- Enforce `schemaVersion: 2` capability-first parsing for workflow actions and adapter
  capability claims.
- Reject legacy `operation`-only payloads for v2 contracts.
- Document rollout and rollback guardrails in ADR-0064.

## Changes

- Updated `parseWorkflowV1` to accept `schemaVersion` 1 or 2 and require `capability`
  on v2 actions.
- Updated `parseAdapterRegistrationV1` to accept `schemaVersion` 1 or 2 and require
  `capability` on v2 capability matrix entries.
- Added unit tests proving v2 acceptance and v2 operation-only rejection in:
  - `src/domain/workflows/workflow-v1.test.ts`
  - `src/domain/adapters/adapter-registration-v1.test.ts`
- Added schema-v2 rollout/rollback guidance to:
  - `docs/internal/adr/0064-domain-api-compatibility-migration.md`

## Validation

- `npm run test -- src/domain/workflows/workflow-v1.test.ts src/domain/adapters/adapter-registration-v1.test.ts`
