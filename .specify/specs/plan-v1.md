# Plan v1 (Structured Intended Effects)

## Purpose

Plans are the durable, versioned objects that approvals sign off on.

This implements ADR-0027: **Planned vs Predicted vs Verified** effects semantics.

## Semantics

- A **Plan** describes _intended_ externally-effectful changes (Planned Effects).
- **Predicted Effects** are optional and only included when a System of Record (SoR) supports a credible preview/dry-run.
- **Verified Effects** are recorded post-execution as evidence (see `evidence-v1.md`).
- Approvals sign off on the Plan, not on predictions.

## Schema (PlanV1)

Fields:

- `schemaVersion`: `1`
- `planId`: branded `PlanId`
- `workspaceId`: branded `WorkspaceId`
- `createdAtIso`: ISO-8601/RFC3339 UTC timestamp string
- `createdByUserId`: branded `UserId`
- `plannedEffects`: `PlannedEffectV1[]` (always present; may be empty for no-op plans)
- `predictedEffects?`: `PredictedEffectV1[]` (optional)

### PlannedEffectV1

- `effectId`: branded `EffectId`
- `operation`: one of `Create | Update | Delete | Upsert`
- `target`: `ExternalObjectRef` (SoR deep link)
- `summary`: human-readable one-line description
- `idempotencyKey?`: string (adapter/provider-specific, if applicable)

### PredictedEffectV1

Same as `PlannedEffectV1`, plus:

- `confidence?`: number in `[0, 1]`

## Privacy and Minimization

- A Plan should avoid embedding raw PII or provider payloads.
- Provider-specific detail should be referenced via `ExternalObjectRef` and/or stored as retention-managed payloads (artifacts/snapshots) linked from evidence.
