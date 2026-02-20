# ADR-0071: Policy Inline Rule Language (Constrained DSL)

**Beads:** bead-0448
**Status:** Accepted
**Date:** 2026-02-20

## Context

`PolicyInlineRuleV1.condition` was previously a free-form string with no defined grammar and no evaluator.  
That created three problems:

- ambiguous authoring semantics,
- no deterministic runtime behavior, and
- security risk if dynamic evaluation were introduced later.

The platform needs a rule language that is:

- expressive enough for common policy predicates,
- deterministic and testable in domain code, and
- safe by construction (no arbitrary code execution).

## Decision

Adopt a **constrained in-process DSL** for `PolicyInlineRuleV1.condition`, evaluated by a dedicated parser/evaluator in domain code.

The selected DSL supports:

- identifiers with dot-path access (`run.tier`, `user.role`),
- literals (`string`, `number`, `boolean`, `null`),
- boolean operators (`&&`, `||`, `!` and aliases `and`, `or`, `not`),
- comparisons (`==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`),
- collection operators (`in`, `contains`),
- parentheses for grouping.

Explicitly **not supported**:

- function calls,
- dynamic imports/eval,
- loops or unbounded constructs,
- mutation side effects.

## Runtime Semantics

1. Parsing

- Conditions are parsed with a strict grammar.
- Invalid syntax fails policy parsing (`PolicyParseError`).

2. Evaluation

- Evaluation occurs against an explicit context map produced by policy evaluation.
- Expressions must resolve to a boolean.
- Evaluation is bounded by an operation budget (`maxOperations`).

3. Failure posture

- Parse errors, evaluation errors, and budget timeout are fail-closed.
- Fail-closed outcome is treated as policy `Deny`.

## Security Boundary

- No runtime code generation or execution APIs are used.
- Evaluation walks a restricted AST only.
- Identifier resolution is read-only against provided context.
- Resource exhaustion is bounded by the operation budget.

## Consequences

Positive:

- deterministic policy behavior with testable semantics,
- reduced attack surface versus general-purpose expression engines,
- straightforward portability across runtimes.

Trade-offs:

- lower expressiveness than CEL/OPA/Rego,
- nested/advanced policy logic must be modelled in context preparation or future DSL evolution.

## Alternatives Considered

1. CEL

- Strong option, but adds dependency and integration surface not yet required for current policy scope.

2. OPA/Rego

- Mature policy system, but heavyweight for current inline rule use and would require external engine/runtime integration.

3. Free-form string + ad hoc evaluators

- Rejected due ambiguity and security risk.

## Implementation Mapping

ADR-0071 implementation coverage now spans DSL definition, parse/evaluate enforcement, and policy-gated
application command paths:

- `bead-0448` (closed): implemented constrained DSL tokenizer/parser/evaluator with fail-closed behavior and ADR/spec publication.
- `bead-0522` (closed): policy evaluation safety-tier enforcement built on deterministic policy evaluation outcomes.
- `bead-0523` (closed): robotics SoD constraints integrated into policy evaluation decisions.
- `bead-0558` (closed): governance-gated high-risk map command path with auditable command intent and policy evaluation enforcement.

## Acceptance Evidence

- DSL parser/tokenizer/evaluator and AST contracts:
  - `src/domain/policy/policy-condition-dsl-v1.ts`
  - `src/domain/policy/policy-condition-dsl-v1.tokenizer.ts`
  - `src/domain/policy/policy-condition-dsl-v1.parser.ts`
  - `src/domain/policy/policy-condition-dsl-v1.evaluator.ts`
  - `src/domain/policy/policy-condition-dsl-v1.types.ts`
  - `src/domain/policy/policy-condition-dsl-v1.test.ts`
- Policy parsing and runtime enforcement integration:
  - `src/domain/policy/policy-v1.ts`
  - `src/domain/policy/policy-v1.test.ts`
  - `src/domain/services/policy-evaluation.ts`
  - `src/domain/services/policy-evaluation.inline-rules.test.ts`
  - `src/domain/services/policy-evaluation.test.ts`
- Application command path consuming policy evaluation outcomes:
  - `src/application/commands/submit-map-command-intent.helpers.ts`
  - `src/application/commands/submit-map-command-intent.test.ts`
- Spec and review linkage:
  - `.specify/specs/policy-v1.md`
  - `bead-0633`
  - `docs/review/bead-0633-adr-0071-linkage-review.md`

## Remaining Gap Tracking

- Governance UI visibility for live inline rule conditions and parsed-policy views remains tracked by
  `bead-0592`.
