# Saga Compensation Interface v1

## Purpose

Define a standard compensation metadata contract for capability matrices so workflow runtimes can execute deterministic rollback/reversal steps after partial failure.

This spec complements `.specify/specs/workflow-action-execution-semantics-v1.md` and maps compensation metadata to `PlanV1.plannedEffects` saga behavior.

## Scope

- Capability matrix compensation metadata fields.
- Runtime-facing semantics for compensation operation dispatch.
- Per-port-family compensation contract pattern with at least one concrete v1 example.

## 1) Capability Matrix Metadata Contract

Each `capabilities[*]` entry MAY declare compensation metadata.

### 1.1 Fields

- `compensationOperation`: capability-style operation key for reversal semantics.
  - format: `<entity>:<verb>`
  - examples: `invoice:reverse`, `payment:void`, `ticket:reopen`
- `compensationInputSchema`: JSON Schema fragment describing the input payload required by `compensationOperation`.

### 1.2 Invariants

- If one compensation field is present, both must be present.
- If compensation metadata is present, `safety.supportsCompensation` MUST be `true`.
- Compensation metadata is optional for capabilities that are read-only or irreversible.

## 2) Runtime Contract Mapping

When a run enters compensation mode:

1. Runtime reads `compensationOperation` and `compensationInputSchema` from the originating capability metadata.
2. Runtime builds `compensationInput` from the failed run context plus verified effect references.
3. Runtime validates `compensationInput` against `compensationInputSchema` before dispatch.
4. Runtime dispatches compensation hooks in reverse successful-completion order (per workflow-action execution semantics spec).

If metadata is absent for a capability with side effects, runtime records a non-compensable failure and continues best-effort compensation for remaining eligible actions.

## 3) Per-Family Contract Pattern

Every port family should document compensation operations for high-liability writes, but v1 requires at least one production-grade family example.

### 3.1 FinanceAccounting v1 baseline (required)

Capability: `invoice:write`

- `compensationOperation`: `invoice:reverse`
- `compensationInputSchema` minimum shape:
  - `invoiceId: string`
  - `reason: string`
  - `reversalDateIso?: string`
  - `idempotencyKey?: string`

Semantics:

- Compensation creates a credit-note/cancellation-style reversal according to provider rules.
- Compensation does not delete evidence of the original write; it creates an explicit balancing action.

## 4) Versioning and Compatibility

- This contract is `v1` and additive.
- Providers that do not support compensation omit metadata and explicitly set `supportsCompensation: false`.
- Future versions may add typed compensation outcome schemas without breaking existing matrices.

## 5) References

- `.specify/specs/workflow-action-execution-semantics-v1.md`
- `.specify/specs/plan-v1.md`
- `domain-atlas/schema/capability-matrix.schema.json`
