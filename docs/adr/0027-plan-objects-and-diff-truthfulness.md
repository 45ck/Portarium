# ADR-0027: Plan Objects and Diff Truthfulness

## Status

Accepted

## Context

SoR APIs vary widely in dry-run/preview support. Promising exact predictions of what will change is unrealistic across all vendors. But approvals need something concrete to sign off on. Without clear semantics around what a "diff" means, users may over-trust previews or lose confidence when actual outcomes diverge from predictions.

## Decision

All approval gates are based on a structured Plan object that describes intended effects. Post-execution, evidence attaches Verified Effects (observed delta). Diffs are explicitly typed:

- **Planned Effects**: what VAOP intends to do, always present.
- **Verified Effects**: what actually changed, observed after execution.
- **Predicted Effects** (optional): best-effort preview where the SoR supports dry-run.

Approvals sign off on Plans, not predictions. The Plan schema is stable and versioned. Evidence comparison between Planned Effects and Verified Effects is a first-class operation, enabling automated drift detection and post-execution audit.

## Consequences

- Preserves the approvals/diff promise without overstating predictability.
- Makes evidence comparison (planned vs actual) a first-class operation for audit and debugging.
- Requires the Plan schema to be stable and versioned, adding governance overhead.
- Adapters that support dry-run can surface richer Predicted Effects, creating a tiered user experience.
