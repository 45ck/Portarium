# GSLR-9 Static Card Projection: 2026-05-13

Status: docs/test-only projection contract, no runtime ingestion  
Tracking bead: `bead-1249`

## Decision

Portarium now has a static projector from GSLR route evidence into
`EngineeringEvidenceCardInputV1`:

```text
src/domain/evidence/gslr-engineering-evidence-card-projection-v1.ts
```

This is the product-safe follow-up to GSLR-8. It creates an operator-readable
card input from checked-in route-policy evidence, but it does not consume live
prompt-language manifests.

## Why

GSLR-8 proved the exact route-record compiler scaffold can run as
`local-screen`: PL owns deterministic policy tables and record envelopes, while
the local model fills bounded predicate hooks.

The next useful product question is not runtime ingestion. It is whether that
evidence can be projected into a static card shape an operator could understand:

```text
Task: gslr8-route-record-compiler
Route: local-screen
Why: PL owned invariants; local filled hooks
Evidence: final verdict pass, private oracle pass, zero frontier tokens
Boundary: research-only
```

## Contract

The projector accepts a static GSLR projection input and emits
`EngineeringEvidenceCardInputV1`.

It proves:

- passing GSLR-8 evidence becomes a `research-only` card;
- failed GSLR-7 evidence becomes a `blocked` card;
- review defects keep a card `blocked`;
- unsafe artifact refs are rejected before card parsing;
- emitted cards are re-validated by `parseEngineeringEvidenceCardInputV1`.

## Still Blocked

Do not create:

- live prompt-language manifest ingestion;
- live Cockpit engineering cards;
- route-record queues;
- route-record database tables;
- runtime decisions from GSLR manifests;
- MC connector observation or school-data movement.

## Validation

Focused validation:

```sh
npm run test -- \
  src/domain/evidence/gslr-engineering-evidence-card-projection-v1.test.ts \
  src/domain/evidence/engineering-evidence-card-v1.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       10 passed (10)
```

## Execution Record

2026-05-13:

- Added the static GSLR evidence-card projector.
- Added tests for GSLR-8 positive, GSLR-7 blocked, review-defect blocked, unsafe
  artifact refs, and malformed input schema versions.
- Kept the implementation in the domain evidence contract layer.
- Kept runtime ingestion and live Cockpit cards blocked.
