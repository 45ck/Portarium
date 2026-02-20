# Execution Tier Policy v1

**Status:** Accepted
**Bead:** bead-0677
**Date:** 2026-02-21

## Context

Portarium deployments span development, staging, and production environments.
Each environment requires different policy strictness: dev should be permissive
for rapid iteration, while production must enforce strict approval gates.

## Decision

Define an `ExecutionTierEnforcementV1` type and `evaluateExecutionTierPolicy`
function in `src/domain/policy/execution-tier-policy-v1.ts`.

### Environment tiers

| Tier      | Enforcement | Override | Approval threshold |
|-----------|------------|----------|--------------------|
| `dev`     | `logged`   | Yes      | ManualOnly         |
| `staging` | `strict`   | Yes      | HumanApprove       |
| `prod`    | `strict`   | No       | Assisted           |

### Tier evaluation rules

1. `ManualOnly` tier always produces a `Deny` decision (requires manual intervention).
2. If the effective tier severity >= the environment's `approvalRequiredAbove` threshold,
   the decision is `RequireApproval`.
3. Otherwise the decision is `Allow`.

### Override mechanism

- Overrides are auditable records (`TierOverrideV1`) containing workspace scope,
  original/overridden tiers, authorizing user, timestamp, and justification.
- Overrides are only permitted when the environment config allows them.
- In `prod`, overrides are disabled by default.
- Override records serve as evidence for compliance audit trails.

## Consequences

- Policy evaluation respects environment context, preventing accidental
  bypass of approval gates in production.
- Dev environments remain unblocked for iteration.
- Override audit trail provides evidence for compliance reviews.
