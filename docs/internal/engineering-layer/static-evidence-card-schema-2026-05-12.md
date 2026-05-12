# Static Engineering Evidence-Card Schema: 2026-05-12

Status: docs/test-only contract, not runtime ingestion
Tracking bead: `bead-1238`
Companion prompt-language bead: `prompt-language-gslr13`

## Decision

Portarium now has a static engineering evidence-card input contract:

```text
src/domain/evidence/engineering-evidence-card-v1.ts
```

This is not connected to a service, queue, Cockpit route, database table, or
prompt-language manifest ingestion path.

## Why

GSLR-3 produced the first live evidence-card transform result:

- `local-only` failed;
- `advisor-only` failed;
- `frontier-only` passed;
- the route for `gslr3-policy-manifest-transform` is `frontier-baseline`.

That is enough to define the static card shape that Portarium should expect
eventually. It is not enough to ingest live runner events.

## Contract

The contract accepts static cards with:

- `schemaVersion: "portarium.evidence-card-input.v1"`;
- prompt-language / harness-arena source metadata;
- work item and run identifiers;
- route arm and optional route-policy decision;
- selected model/provider;
- final verdict, private oracle, and blocking review defects;
- aggregate frontier/local cost telemetry;
- action boundary: `research-only` or `blocked`;
- artifact references only.

The parser rejects:

- malformed non-object cards;
- unsupported route arms or action statuses;
- raw payload, source payload, student payload, credential, secret, token,
  password, oracle command, raw stdout, raw stderr, or hidden oracle body keys;
- artifact references with query strings or fragments;
- `research-only` action boundaries when verdict, oracle, or review evidence is
  blocking.

## Product Boundary

Runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

No production service should consume prompt-language manifests yet.

This schema is a stable R&D contract for tests, docs, and future design work.
The current transform route remains `frontier-baseline`.

Follow-up on 2026-05-12: prompt-language added the GSLR-4 two-file validator
fixture. That fixture tests validation of this static card shape across a
separate action-boundary helper and validator. The result is deterministic
fake-live harness evidence only; runtime ingestion and live Cockpit cards remain
blocked.

Live follow-up on 2026-05-12: GSLR-4 advisor-only and frontier-only both passed,
but frontier-only used fewer frontier tokens. Local-only failed the private
oracle. The static schema remains useful, but the selected route for this
validator shape is `frontier-baseline`; runtime ingestion and live Cockpit cards
remain blocked.

## Validation

Focused validation:

```sh
npm run test -- src/domain/evidence/engineering-evidence-card-v1.test.ts
```

The tests prove:

- the GSLR-3 frontier-baseline card shape parses;
- failed local/advisor evidence can still become a blocked card;
- raw payload and secret keys are rejected;
- artifact refs cannot carry query or fragment payloads;
- `research-only` cannot be used when blocking evidence exists.

## Execution Record

2026-05-12:

- Created and closed `bead-1238`.
- Added `EngineeringEvidenceCardInputV1` and parser tests.
- Recorded that the contract is docs/test-only and does not authorize runtime
  ingestion.
- Recorded the GSLR-4 follow-up as a validator scaffold only, not product
  ingestion.
- Recorded the GSLR-4 live result as frontier-baseline for this validator shape.
